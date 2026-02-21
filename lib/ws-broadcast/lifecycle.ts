import type { WebSocket } from "ws";
import { clients, logSubscribers } from "./clients";
import { sendLogHistoryToClient } from "./log-stream";

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
}

export function unregisterClient(ws: WebSocket): void {
  clients.delete(ws);
  logSubscribers.forEach((subs) => subs.delete(ws));
}

export function subscribeLogs(ws: WebSocket, runId: number): void {
  if (!logSubscribers.has(runId)) {
    logSubscribers.set(runId, new Set());
  }
  logSubscribers.get(runId)!.add(ws);
  sendLogHistoryToClient(ws, runId);
}

export function unsubscribeLogs(ws: WebSocket, runId: number): void {
  logSubscribers.get(runId)?.delete(ws);
}
