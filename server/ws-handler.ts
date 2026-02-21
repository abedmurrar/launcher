import type { WebSocket } from "ws";
import {
  sendInitialDump,
  subscribeLogs,
  unsubscribeLogs,
} from "../lib/ws-broadcast";
import { handleAction, isActionType } from "../lib/ws-action-handlers";

export type IncomingMessage = {
  type: string;
  requestId?: string;
  runId?: number;
  commandId?: number;
  groupId?: number;
  id?: number;
  data?: unknown;
  name?: string;
  commandIds?: number[];
};

export function parseIncomingMessage(raw: Buffer | string): IncomingMessage | null {
  try {
    return JSON.parse(raw.toString()) as IncomingMessage;
  } catch {
    return null;
  }
}

export function handleWebSocketMessage(ws: WebSocket, raw: Buffer | string): void {
  const msg = parseIncomingMessage(raw);
  if (!msg?.type) return;

  switch (msg.type) {
    case "initial":
      sendInitialDump(ws);
      break;
    case "subscribe_logs":
      if (typeof msg.runId === "number") {
        subscribeLogs(ws, msg.runId);
      }
      break;
    case "unsubscribe_logs":
      if (typeof msg.runId === "number") {
        unsubscribeLogs(ws, msg.runId);
      }
      break;
    default:
      if (isActionType(msg.type)) {
        handleAction(ws, msg.type, msg.requestId, msg as Record<string, unknown>);
      }
      break;
  }
}
