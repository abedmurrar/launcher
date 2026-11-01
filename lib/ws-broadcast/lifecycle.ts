import type { Socket } from "socket.io";
import { runRoom } from "./clients";
import { sendLogHistoryToClient } from "./log-stream";

export function subscribeLogs(socket: Socket, runId: number): void {
  void socket.join(runRoom(runId));
  void sendLogHistoryToClient(socket, runId).catch((err) =>
    console.error("[ws] sendLogHistoryToClient failed:", err)
  );
}

export function unsubscribeLogs(socket: Socket, runId: number): void {
  void socket.leave(runRoom(runId));
}
