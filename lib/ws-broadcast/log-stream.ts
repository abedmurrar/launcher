import type { Socket } from "socket.io";
import { getRunDetailsById, getLogTailByRunId } from "@/lib/db/queries";
import type { LiveLogChunk } from "@/lib/process-manager/state";
import { config } from "@/lib/config";
import { getIo, runRoom } from "./clients";
import { send } from "./send";

/** Send the tail of a run's persisted log (bounded by `logHistoryMaxBytes`). */
export async function sendLogHistoryToClient(socket: Socket, runId: number): Promise<void> {
  const run = await getRunDetailsById(runId);
  if (!run) return;
  const tail = await getLogTailByRunId(runId, config.logHistoryMaxBytes);
  send(socket, "log_history", {
    runId,
    live: run.status === "running",
    chunks: tail.chunks.map((c) => ({ stream_type: c.stream_type, content: c.content })),
    truncated: tail.truncated,
    lastId: tail.lastId,
    firstId: tail.firstId,
  });
}

export function pushLogBatch(runId: number, chunks: LiveLogChunk[], lastId: number | undefined): void {
  getIo()?.to(runRoom(runId)).emit("log_batch", { runId, chunks, lastId });
}

export function pushLogFinished(runId: number): void {
  const io = getIo();
  if (!io) return;
  const room = runRoom(runId);
  io.to(room).emit("log_finished", { runId });
  io.in(room).socketsLeave(room);
}
