import type { WebSocket } from "ws";
import { runExists, getLogChunksByRunId } from "@/lib/db/queries";
import { logSubscribers } from "./clients";
import { send } from "./send";
import { WsMessageFactory } from "./message-factory";

function getLogChunksForRun(runId: number): ReturnType<typeof getLogChunksByRunId> {
  if (!runExists(runId)) return [];
  return getLogChunksByRunId(runId);
}

export function sendLogHistoryToClient(ws: WebSocket, runId: number): void {
  const chunks = getLogChunksForRun(runId);
  if (chunks.length > 0) {
    send(ws, WsMessageFactory.logHistory(runId, chunks));
  }
}

export function pushLogChunk(
  runId: number,
  content: string,
  streamType: "stdout" | "stderr"
): void {
  const payload = WsMessageFactory.log(runId, streamType, content);
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((clientWs) => send(clientWs, payload));
}

export function pushLogFinished(runId: number): void {
  const payload = WsMessageFactory.logFinished(runId);
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((clientWs) => send(clientWs, payload));
  logSubscribers.delete(runId);
}
