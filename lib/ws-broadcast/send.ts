import type { Socket } from "socket.io";

export function send(socket: Socket, event: string, payload: unknown): void {
  if (!socket.connected) return;
  try {
    socket.emit(event, payload);
  } catch {
    // ignore
  }
}

export function sendToClient(socket: Socket, event: string, payload: unknown): void {
  send(socket, event, payload);
}

export function broadcast(clients: Set<Socket>, event: string, payload: unknown): void {
  clients.forEach((socket) => send(socket, event, payload));
}
