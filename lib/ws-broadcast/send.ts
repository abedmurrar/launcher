import type { Socket } from "socket.io";

export function send(socket: Socket, event: string, payload: unknown): void {
  if (!socket.connected) return;
  try {
    socket.emit(event, payload);
  } catch (err) {
    console.error(`[ws] emit ${event} failed:`, err);
  }
}
