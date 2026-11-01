import type { Server, Socket } from "socket.io";
import { globalSingleton } from "@/lib/global-singleton";

/**
 * Shared Socket.IO server handle (set by the custom server, read by route handlers too).
 * Log subscriptions use Socket.IO rooms named `run:<id>`.
 */
const holder = globalSingleton("ws-io", () => ({ io: null as Server | null }));

export function setIo(io: Server): void {
  holder.io = io;
}

export function getIo(): Server | null {
  return holder.io;
}

export function runRoom(runId: number): string {
  return `run:${runId}`;
}

export type { Socket };
