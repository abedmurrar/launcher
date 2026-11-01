import fs from "fs";
import { globalSingleton } from "@/lib/global-singleton";
import { config } from "@/lib/config";
import { insertLogChunksBatch, type LogChunkInsert, type RunLogOffsets } from "@/lib/db/queries";
import { emitLogBatchToHooks } from "./state";
import { runFilePaths, utf8SafeLength, type StreamType } from "./run-files";

/** Max bytes read per stream per tick (a drain loops until caught up). */
const MAX_READ_BYTES = 1024 * 1024;
const STREAMS: StreamType[] = ["stdout", "stderr"];

interface Tail {
  offsets: RunLogOffsets;
  /** In-flight read, so ticks never overlap and drains can wait for it. */
  current: Promise<boolean> | null;
}

const state = globalSingleton("log-tailer", () => ({
  tails: new Map<number, Tail>(),
  timer: null as ReturnType<typeof setInterval> | null,
}));

function ensureTicker(): void {
  if (state.timer !== null) return;
  state.timer = setInterval(() => {
    for (const runId of state.tails.keys()) void readOnce(runId);
  }, config.logFlushIntervalMs);
  state.timer.unref?.();
}

function stopTickerIfIdle(): void {
  if (state.tails.size === 0 && state.timer !== null) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

async function readStream(
  file: string,
  offset: number
): Promise<{ text: string; offset: number; size: number } | null> {
  let handle: fs.promises.FileHandle;
  try {
    handle = await fs.promises.open(file, "r");
  } catch {
    return null; // not created / already removed
  }
  try {
    const { size } = await handle.stat();
    if (size < offset) offset = 0; // truncated externally
    if (size === offset) return { text: "", offset, size };
    const length = Math.min(size - offset, MAX_READ_BYTES);
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, length, offset);
    const usable = utf8SafeLength(buf.subarray(0, bytesRead));
    return { text: buf.toString("utf8", 0, usable), offset: offset + usable, size };
  } finally {
    await handle.close();
  }
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
      const result = await readStream(paths[stream], tail.offsets[stream]);
      if (!result) continue;
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
    if (t) t.current = null;
  });

  return tail.current;
}

/** Start (or resume, from persisted offsets) tailing a run's log files. */
export function startTailing(runId: number, offsets: RunLogOffsets = { stdout: 0, stderr: 0 }): void {
  if (state.tails.has(runId)) return;
  state.tails.set(runId, { offsets: { ...offsets }, current: null });
  ensureTicker();
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
  state.tails.delete(runId);
  stopTickerIfIdle();
}

/** Wait for in-flight reads and stop the ticker (shutdown). Offsets are already persisted. */
export async function stopAllTailing(): Promise<void> {
  const pending = [...state.tails.values()].map((t) => t.current).filter(Boolean);
  await Promise.all(pending.map((p) => p!.catch(() => false)));
  state.tails.clear();
  stopTickerIfIdle();
}

export function tailedRunIds(): number[] {
  return [...state.tails.keys()];
}
