import type { WebSocket } from "ws";
import { buildCommandsList } from "@/lib/commands-list";
import { buildGroupsList } from "@/lib/groups-list";
import { clients } from "./clients";
import { send, broadcast } from "./send";
import { WsMessageFactory } from "./message-factory";

function onRunStateChange(): void {
  broadcast(clients, WsMessageFactory.commands(buildCommandsList()));
  broadcast(clients, WsMessageFactory.groups(buildGroupsList()));
}

export function broadcastCommands(): void {
  broadcast(clients, WsMessageFactory.commands(buildCommandsList()));
}

export function broadcastGroups(): void {
  broadcast(clients, WsMessageFactory.groups(buildGroupsList()));
}

export function sendInitialDump(ws: WebSocket): void {
  try {
    send(ws, WsMessageFactory.commands(buildCommandsList()));
    send(ws, WsMessageFactory.groups(buildGroupsList()));
  } catch {
    send(ws, WsMessageFactory.commands([]));
    send(ws, WsMessageFactory.groups([]));
  }
}

export { onRunStateChange };
