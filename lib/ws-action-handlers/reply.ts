import type { WebSocket } from "ws";
import { sendToClient } from "@/lib/ws-broadcast";
import type { ActionPayload, ActionResult } from "./types";

const WS_OPEN = 1;

export function sendResult(
  ws: WebSocket,
  type: string,
  requestId: string | undefined,
  result: ActionResult
): void {
  if (ws.readyState !== WS_OPEN) return;
  sendToClient(ws, { type: `${type}_result`, requestId, ...result });
}

export function parseId(value: unknown): number {
  return Number(value);
}

export function parseOptionalRunId(payload: ActionPayload): number | undefined {
  const runId = payload.runId;
  if (runId == null) return undefined;
  return Number(runId);
}
