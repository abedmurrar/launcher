import type { WebSocket } from "ws";

const WS_OPEN = 1;

export function send(ws: WebSocket, payload: unknown): void {
  if (ws.readyState !== WS_OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function sendToClient(ws: WebSocket, payload: unknown): void {
  send(ws, payload);
}

export function broadcast(clients: Set<WebSocket>, payload: unknown): void {
  clients.forEach((ws) => send(ws, payload));
}
