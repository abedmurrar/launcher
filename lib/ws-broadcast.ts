import type { WebSocket } from "ws";
import { getDb } from "@/lib/db";
import { buildCommandsList } from "@/lib/commands-list";
import { buildGroupsList } from "@/lib/groups-list";
import {
  setRunStateChangeCallback,
  setLogHooks,
} from "@/lib/process-manager";

const clients = new Set<WebSocket>();
const logSubscribers = new Map<number, Set<WebSocket>>();

function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== 1) return; // OPEN
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function sendToClient(ws: WebSocket, payload: unknown): void {
  send(ws, payload);
}

function broadcast(payload: unknown): void {
  clients.forEach((ws) => send(ws, payload));
}

export function broadcastCommands(): void {
  broadcast({ type: "commands", data: buildCommandsList() });
}

export function broadcastGroups(): void {
  broadcast({ type: "groups", data: buildGroupsList() });
}

function onRunStateChange(): void {
  broadcastCommands();
  broadcastGroups();
}

export function pushLogChunk(
  runId: number,
  content: string,
  streamType: "stdout" | "stderr"
): void {
  const payload = { type: "log", runId, streamType, data: content };
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((ws) => send(ws, payload));
}

export function pushLogFinished(runId: number): void {
  const payload = { type: "log_finished", runId };
  const subs = logSubscribers.get(runId);
  if (subs) subs.forEach((ws) => send(ws, payload));
  logSubscribers.delete(runId);
}

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
  send(ws, { type: "commands", data: buildCommandsList() });
  send(ws, { type: "groups", data: buildGroupsList() });
}

export function unregisterClient(ws: WebSocket): void {
  clients.delete(ws);
  logSubscribers.forEach((subs) => subs.delete(ws));
}

export function subscribeLogs(ws: WebSocket, runId: number): void {
  if (!logSubscribers.has(runId)) logSubscribers.set(runId, new Set());
  logSubscribers.get(runId)!.add(ws);
  const db = getDb();
  const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
  if (run) {
    const chunks = db
      .prepare(
        "SELECT stream_type, content FROM log_chunks WHERE run_id = ? ORDER BY id ASC"
      )
      .all(runId) as Array<{ stream_type: string; content: string }>;
    send(ws, { type: "log_history", runId, chunks });
  }
}

export function unsubscribeLogs(ws: WebSocket, runId: number): void {
  logSubscribers.get(runId)?.delete(ws);
}

export function init(): void {
  setRunStateChangeCallback(onRunStateChange);
  setLogHooks({
    onChunk: pushLogChunk,
    onFinished: pushLogFinished,
  });
}
