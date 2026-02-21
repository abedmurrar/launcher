import type { Socket } from "socket.io";
import { buildCommandsList } from "@/lib/commands-list";
import { buildGroupsList } from "@/lib/groups-list";
import { clients } from "./clients";
import { send, broadcast } from "./send";

function onRunStateChange(): void {
  broadcast(clients, "commands", buildCommandsList());
  broadcast(clients, "groups", buildGroupsList());
}

export function broadcastCommands(): void {
  broadcast(clients, "commands", buildCommandsList());
}

export function broadcastGroups(): void {
  broadcast(clients, "groups", buildGroupsList());
}

export function sendInitialDump(socket: Socket): void {
  try {
    send(socket, "commands", buildCommandsList());
    send(socket, "groups", buildGroupsList());
  } catch {
    send(socket, "commands", []);
    send(socket, "groups", []);
  }
}

export { onRunStateChange };
