import type { Socket } from "socket.io";
import { runExists, getLogChunksByRunId } from "@/lib/db/queries";
import { logSubscribers } from "./clients";
import { send } from "./send";

async function getLogChunksForRun(runId: number): Promise<ReturnType<typeof getLogChunksByRunId>> {
  if (!(await runExists(runId))) return [];
  return getLogChunksByRunId(runId);
}

export async function sendLogHistoryToClient(socket: Socket, runId: number): Promise<void> {
  const chunks = await getLogChunksForRun(runId);
  if (chunks.length > 0) {
    send(socket, "log_history", { runId, chunks });
  }
}

export function pushLogChunk(
  runId: number,
  content: string,
  streamType: "stdout" | "stderr"
): void {
  const payload = { runId, streamType, data: content };
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((socket) => send(socket, "log", payload));
}

export function pushLogFinished(runId: number): void {
  const payload = { runId };
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((socket) => send(socket, "log_finished", payload));
  logSubscribers.delete(runId);
}
