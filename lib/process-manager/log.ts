import { insertLogChunksBatch, type LogChunkInsert } from "@/lib/db/queries";
import { globalSingleton } from "@/lib/global-singleton";
import { config } from "@/lib/config";
import { emitLogBatchToHooks } from "./state";

type StreamType = "stdout" | "stderr";

interface RunLogBuffer {
  chunks: LogChunkInsert[];
  bytes: number;
  timer: ReturnType<typeof setTimeout> | null;
  /** Serializes flushes for a run so batches land (and are emitted) in order. */
  chain: Promise<void>;
}

const buffers = globalSingleton("log-buffers", () => new Map<number, RunLogBuffer>());

function getBuffer(runId: number): RunLogBuffer {
  let buf = buffers.get(runId);
  if (!buf) {
    buf = { chunks: [], bytes: 0, timer: null, chain: Promise.resolve() };
    buffers.set(runId, buf);
  }
  return buf;
}

/**
 * Buffer a chunk of process output. Consecutive chunks of the same stream are merged,
 * and the buffer is flushed (one DB transaction + one socket emit) every
 * `logFlushIntervalMs` or once it reaches `logFlushMaxBytes`.
 */
export function emitLogChunk(runId: number, content: string, streamType: StreamType): void {
  if (content.length === 0) return;
  const buf = getBuffer(runId);
  const last = buf.chunks[buf.chunks.length - 1];
  if (last && last.stream_type === streamType) {
    last.content += content;
  } else {
    buf.chunks.push({ stream_type: streamType, content });
  }
  buf.bytes += content.length;

  if (buf.bytes >= config.logFlushMaxBytes) {
    void flushRunLog(runId);
  } else if (buf.timer === null) {
    buf.timer = setTimeout(() => void flushRunLog(runId), config.logFlushIntervalMs);
  }
}

/** Flush buffered output for a run. Resolves once it has been written and emitted. */
export function flushRunLog(runId: number): Promise<void> {
  const buf = buffers.get(runId);
  if (!buf) return Promise.resolve();
  if (buf.timer !== null) {
    clearTimeout(buf.timer);
    buf.timer = null;
  }
  const chunks = buf.chunks;
  buf.chunks = [];
  buf.bytes = 0;
  if (chunks.length > 0) {
    buf.chain = buf.chain.then(async () => {
      let lastId: number | undefined;
      try {
        lastId = await insertLogChunksBatch(runId, chunks);
      } catch (err) {
        console.error("[run] insertLogChunksBatch failed:", err);
      }
      emitLogBatchToHooks(
        runId,
        chunks.map((c) => ({ streamType: c.stream_type, data: c.content })),
        lastId
      );
    });
  }
  return buf.chain;
}

/** Flush and drop the buffer for a finished run. */
export async function finishRunLog(runId: number): Promise<void> {
  await flushRunLog(runId);
  const buf = buffers.get(runId);
  if (buf && buf.chunks.length === 0 && buf.timer === null) {
    buffers.delete(runId);
  }
}

/** Flush every run's buffer (used on shutdown). */
export async function flushAllLogs(): Promise<void> {
  await Promise.all(Array.from(buffers.keys()).map((runId) => flushRunLog(runId)));
}
