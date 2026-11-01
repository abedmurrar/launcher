import fs from "fs";
import { globalSingleton } from "@/lib/global-singleton";
import { config } from "@/lib/config";
import { insertLogChunksBatch, type LogChunkInsert, type RunLogOffsets } from "@/lib/db/queries";
import { emitLogBatchToHooks } from "./state";
import { getLogsDir, runFilePaths, utf8SafeLength, type StreamType } from "./run-files";

/**
 * Tails runs' output files into the DB + live log events.
 *
 * Reads are event-driven: an inotify watcher (fs.watch) on the logs directory triggers a read as
 * soon as a run's file changes, throttled to one read per `logFlushIntervalMs` per run so chatty
 * output is batched. A slow safety poll catches anything the watcher misses; if the watcher can't
 * be created, polling falls back to every `logFlushIntervalMs`. File handles stay open per run.
 */

/** Max bytes read per stream per read (a drain loops until caught up). */
const MAX_READ_BYTES = 1024 * 1024;
const STREAMS: StreamType[] = ["stdout", "stderr"];
const SAFETY_POLL_MS = 1_000;

interface Tail {
  offsets: RunLogOffsets;
  handles: Partial<Record<StreamType, fs.promises.FileHandle>>;
  /** In-flight read, so reads never overlap and drains can wait for it. */
  current: Promise<boolean> | null;
  /** More data arrived during the in-flight read. */
  dirty: boolean;
  lastReadAt: number;
  throttle: ReturnType<typeof setTimeout> | null;
}

const state = globalSingleton("log-tailer", () => ({
  tails: new Map<number, Tail>(),
  poll: null as ReturnType<typeof setInterval> | null,
  watcher: null as fs.FSWatcher | null,
}));

/** Schedule a read for a run: now if idle, else after the throttle window / in-flight read. */
function requestRead(runId: number): void {
  const tail = state.tails.get(runId);
  if (!tail) return;
  if (tail.current) {
    tail.dirty = true;
    return;
  }
  if (tail.throttle) return;
  const wait = tail.lastReadAt + config.logFlushIntervalMs - Date.now();
  if (wait <= 0) {
    void readOnce(runId);
  } else {
    tail.throttle = setTimeout(() => {
      tail.throttle = null;
      void readOnce(runId);
    }, wait);
  }
}

function ensureWatching(): void {
  if (state.poll !== null) return;
  try {
    state.watcher = fs.watch(getLogsDir(), (_event, filename) => {
      const name = filename?.toString() ?? "";
      const match = /^(\d+)\.(stdout|stderr)$/.exec(name);
      if (match) requestRead(Number(match[1]));
      else if (!name) for (const runId of state.tails.keys()) requestRead(runId);
    });
    state.watcher.on("error", (err) => console.error("[log-tailer] watcher error:", err));
    state.watcher.unref?.();
  } catch (err) {
    console.warn("[log-tailer] fs.watch unavailable, polling instead:", (err as Error).message);
    state.watcher = null;
  }
  const interval = state.watcher ? SAFETY_POLL_MS : config.logFlushIntervalMs;
  state.poll = setInterval(() => {
    for (const runId of state.tails.keys()) requestRead(runId);
  }, interval);
  state.poll.unref?.();
}

function stopWatchingIfIdle(): void {
  if (state.tails.size > 0) return;
  if (state.poll !== null) clearInterval(state.poll);
  state.poll = null;
  state.watcher?.close();
  state.watcher = null;
}

async function getHandle(tail: Tail, file: string, stream: StreamType): Promise<fs.promises.FileHandle | null> {
  const existing = tail.handles[stream];
  if (existing) return existing;
  try {
    const handle = await fs.promises.open(file, "r");
    tail.handles[stream] = handle;
    return handle;
  } catch {
    return null; // not created yet / already removed
  }
}

async function readStream(
  handle: fs.promises.FileHandle,
  offset: number
): Promise<{ text: string; offset: number; size: number }> {
  const { size } = await handle.stat();
  if (size < offset) offset = 0; // truncated (compaction)
  if (size === offset) return { text: "", offset, size };
  const length = Math.min(size - offset, MAX_READ_BYTES);
  const buf = Buffer.alloc(length);
  const { bytesRead } = await handle.read(buf, 0, length, offset);
  const usable = utf8SafeLength(buf.subarray(0, bytesRead));
  return { text: buf.toString("utf8", 0, usable), offset: offset + usable, size };
}

async function closeHandles(tail: Tail): Promise<void> {
  await Promise.all(
    Object.values(tail.handles).map((h) => h?.close().catch(() => undefined))
  );
  tail.handles = {};
}

/** Ingest new output for a run once. Resolves true if anything new was read. */
function readOnce(runId: number): Promise<boolean> {
  const tail = state.tails.get(runId);
  if (!tail) return Promise.resolve(false);
  if (tail.current) return tail.current;

  tail.current = (async () => {
    const paths = runFilePaths(runId);
    const chunks: LogChunkInsert[] = [];
    const next: RunLogOffsets = { ...tail.offsets };
    const compact: StreamType[] = [];

    for (const stream of STREAMS) {
      const handle = await getHandle(tail, paths[stream], stream);
      if (!handle) continue;
      const result = await readStream(handle, tail.offsets[stream]);
      if (result.text) chunks.push({ stream_type: stream, content: result.text });
      next[stream] = result.offset;
      if (result.offset === result.size && result.size > config.logFileCompactBytes) compact.push(stream);
    }

    const moved = next.stdout !== tail.offsets.stdout || next.stderr !== tail.offsets.stderr;
    if (!moved && compact.length === 0) return false;

    if (moved) {
      let lastId: number | undefined;
      try {
        lastId = await insertLogChunksBatch(runId, chunks, next);
      } catch (err) {
        console.error(`[run ${runId}] log ingest failed:`, err);
        return false; // offsets not advanced; retried next tick
      }
      tail.offsets = next;
      if (chunks.length > 0) {
        emitLogBatchToHooks(
          runId,
          chunks.map((c) => ({ streamType: c.stream_type, data: c.content })),
          lastId
        );
      }
    }

    // Keep files small for long-running processes. The child writes with O_APPEND, so after
    // truncation it continues at the new end; bytes written between the size check and the
    // truncate (a microsecond window) can be lost.
    for (const stream of compact) {
      try {
        await fs.promises.truncate(paths[stream], 0);
        tail.offsets = { ...tail.offsets, [stream]: 0 };
        await insertLogChunksBatch(runId, [], tail.offsets);
      } catch (err) {
        console.error(`[run ${runId}] log compaction failed:`, err);
      }
    }
    return chunks.length > 0;
  })().finally(() => {
    const t = state.tails.get(runId);
    if (!t) return;
    t.current = null;
    t.lastReadAt = Date.now();
    if (t.dirty) {
      t.dirty = false;
      requestRead(runId);
    }
  });

  return tail.current;
}

/** Start (or resume, from persisted offsets) tailing a run's log files. */
export function startTailing(runId: number, offsets: RunLogOffsets = { stdout: 0, stderr: 0 }): void {
  if (state.tails.has(runId)) return;
  state.tails.set(runId, {
    offsets: { ...offsets },
    handles: {},
    current: null,
    dirty: false,
    lastReadAt: 0,
    throttle: null,
  });
  ensureWatching();
  requestRead(runId);
}

export function isTailing(runId: number): boolean {
  return state.tails.has(runId);
}

/** Stop tailing a run, first ingesting everything written so far when `drain` is set. */
export async function stopTailing(runId: number, opts: { drain?: boolean } = {}): Promise<void> {
  const tail = state.tails.get(runId);
  if (!tail) return;
  if (tail.current) await tail.current.catch(() => false);
  if (opts.drain) {
    // Loop until a read finds nothing new (bounded in case something keeps writing).
    for (let i = 0; i < 200; i++) {
      if (!(await readOnce(runId).catch(() => false))) break;
    }
  }
  if (tail.throttle) clearTimeout(tail.throttle);
  state.tails.delete(runId);
  await closeHandles(tail);
  stopWatchingIfIdle();
}

/** Wait for in-flight reads and stop the ticker (shutdown). Offsets are already persisted. */
export async function stopAllTailing(): Promise<void> {
  const tails = [...state.tails.values()];
  await Promise.all(tails.map((t) => t.current?.catch(() => false)));
  for (const t of tails) if (t.throttle) clearTimeout(t.throttle);
  state.tails.clear();
  await Promise.all(tails.map(closeHandles));
  stopWatchingIfIdle();
}

export function tailedRunIds(): number[] {
  return [...state.tails.keys()];
}
