import type { Socket } from "socket.io";
import { buildCommandsList } from "@/lib/commands-list";
import { buildGroupsList } from "@/lib/groups-list";
import { clients } from "./clients";
import { send, broadcast } from "./send";

async function onRunStateChange(): Promise<void> {
  const [commands, groups] = await Promise.all([buildCommandsList(), buildGroupsList()]);
  broadcast(clients, "commands", commands);
  broadcast(clients, "groups", groups);
}

export async function broadcastCommands(): Promise<void> {
  const list = await buildCommandsList();
  broadcast(clients, "commands", list);
}

export async function broadcastGroups(): Promise<void> {
  const list = await buildGroupsList();
  broadcast(clients, "groups", list);
}

export async function sendInitialDump(socket: Socket): Promise<void> {
  try {
    const [commands, groups] = await Promise.all([buildCommandsList(), buildGroupsList()]);
    send(socket, "commands", commands);
    send(socket, "groups", groups);
  } catch {
    send(socket, "commands", []);
    send(socket, "groups", []);
  }
}

export { onRunStateChange };
