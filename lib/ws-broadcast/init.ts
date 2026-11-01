import type { Server } from "socket.io";
import { subscribeRunStateChange, subscribeLogEvents } from "@/lib/process-manager";
import { globalSingleton } from "@/lib/global-singleton";
import { setIo } from "./clients";
import { scheduleListsBroadcast } from "./lists";
import { pushLogBatch, pushLogFinished } from "./log-stream";

const initState = globalSingleton("ws-init", () => ({ done: false }));

/** Wire process-manager events to Socket.IO. Idempotent. */
export function init(io: Server): void {
  setIo(io);
  if (initState.done) return;
  initState.done = true;
  subscribeRunStateChange(scheduleListsBroadcast);
  subscribeLogEvents({
    onBatch: pushLogBatch,
    onFinished: pushLogFinished,
  });
}
