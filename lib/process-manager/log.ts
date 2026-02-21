import type { SSEWriter } from "./types";
import { insertLogChunk } from "@/lib/db/queries";
import { emitLogToHooks, notifyLogFinished, notifyRunStateChange } from "./state";
const sseWriters = new Map<number, Set<SSEWriter>>();

export function registerSSEWriter(runId: number, writer: SSEWriter): () => void {
  if (!sseWriters.has(runId)) {
    sseWriters.set(runId, new Set());
  }
  sseWriters.get(runId)!.add(writer);
  return () => {
    sseWriters.get(runId)?.delete(writer);
  };
}

export function emitLogChunk(runId: number, content: string, streamType: "stdout" | "stderr"): void {
  insertLogChunk(runId, streamType, content);

  const writers = sseWriters.get(runId);
  if (writers) {
    writers.forEach((w) => w(content, streamType));
  }
  emitLogToHooks(runId, content, streamType);
}

export function finishRunLog(runId: number): void {
  sseWriters.get(runId)?.forEach((w) => w("[run finished]", "stdout"));
  sseWriters.delete(runId);
}
