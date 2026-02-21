import type { Socket } from "socket.io";
import { clients, logSubscribers } from "./clients";
import { sendLogHistoryToClient } from "./log-stream";

export function registerClient(socket: Socket): void {
  clients.add(socket);
}

export function unregisterClient(socket: Socket): void {
  clients.delete(socket);
  logSubscribers.forEach((subs) => subs.delete(socket));
}

export function subscribeLogs(socket: Socket, runId: number): void {
  if (!logSubscribers.has(runId)) {
    logSubscribers.set(runId, new Set());
  }
  logSubscribers.get(runId)!.add(socket);
  sendLogHistoryToClient(socket, runId);
}

export function unsubscribeLogs(socket: Socket, runId: number): void {
  logSubscribers.get(runId)?.delete(socket);
}
