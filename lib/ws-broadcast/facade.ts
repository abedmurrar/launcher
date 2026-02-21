import { getWsBroadcastStateInstance } from "./clients";
import { sendToClient } from "./send";
import { broadcastCommands, broadcastGroups, sendInitialDump } from "./lists";
import { pushLogChunk, pushLogFinished } from "./log-stream";
import { registerClient, unregisterClient, subscribeLogs, unsubscribeLogs } from "./lifecycle";
import { init } from "./init";

/**
 * Facade: single entry point for WebSocket broadcast (clients, lists, logs, lifecycle).
 */
export const wsBroadcast = {
  init,
  registerClient,
  unregisterClient,
  subscribeLogs,
  unsubscribeLogs,
  broadcastCommands,
  broadcastGroups,
  sendInitialDump,
  pushLogChunk,
  pushLogFinished,
  sendToClient,
  getState: getWsBroadcastStateInstance,
} as const;
