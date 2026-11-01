import crypto from "crypto";
import type { Socket } from "socket.io";
import { buildCommandsList } from "@/lib/commands-list";
import { buildGroupsList } from "@/lib/groups-list";
import { getRestoreOffers } from "@/lib/actions/restore";
import { globalSingleton } from "@/lib/global-singleton";
import { config } from "@/lib/config";
import { getIo } from "./clients";
import { send } from "./send";

/** Changes on every launcher start; lets clients notice a restart. */
const instance = globalSingleton("instance-id", () => ({ id: crypto.randomUUID() }));
export function getInstanceId(): string {
  return instance.id;
}

const scheduler = globalSingleton("lists-broadcast", () => ({
  timer: null as ReturnType<typeof setTimeout> | null,
  building: false,
  dirty: false,
}));

async function broadcastListsNow(): Promise<void> {
  const io = getIo();
  if (!io) return;
  const [commands, groups, offers] = await Promise.all([
    buildCommandsList(),
    buildGroupsList(),
    getRestoreOffers(),
  ]);
  io.emit("commands", commands);
  io.emit("groups", groups);
  io.emit("restore_offers", offers);
}

async function runScheduled(): Promise<void> {
  scheduler.timer = null;
  if (scheduler.building) {
    scheduler.dirty = true;
    return;
  }
  scheduler.building = true;
  try {
    await broadcastListsNow();
  } catch (err) {
    console.error("[ws] list broadcast failed:", err);
  } finally {
    scheduler.building = false;
    if (scheduler.dirty) {
      scheduler.dirty = false;
      scheduleListsBroadcast();
    }
  }
}

/**
 * Coalesce list rebuilds: any number of state changes within `listBroadcastDebounceMs`
 * produce a single rebuild + broadcast, and rebuilds never overlap.
 */
export function scheduleListsBroadcast(): void {
  if (scheduler.timer !== null) return;
  scheduler.timer = setTimeout(() => void runScheduled(), config.listBroadcastDebounceMs);
}

/** Kept for call sites: both now schedule a (debounced) broadcast of both lists. */
export async function broadcastCommands(): Promise<void> {
  scheduleListsBroadcast();
}

export async function broadcastGroups(): Promise<void> {
  scheduleListsBroadcast();
}

export async function sendInitialDump(socket: Socket): Promise<void> {
  try {
    const [commands, groups, offers] = await Promise.all([
      buildCommandsList(),
      buildGroupsList(),
      getRestoreOffers(),
    ]);
    send(socket, "hello", { instanceId: getInstanceId() });
    send(socket, "commands", commands);
    send(socket, "groups", groups);
    send(socket, "restore_offers", offers);
  } catch (err) {
    console.error("[ws] sendInitialDump failed:", err);
    send(socket, "commands", []);
    send(socket, "groups", []);
  }
}
