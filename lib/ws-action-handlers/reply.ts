import type { Socket } from "socket.io";
import type { ActionPayload, ActionResult } from "./types";

export function sendResult(
  socket: Socket,
  _type: string,
  requestId: string | undefined,
  result: ActionResult
): void {
  if (!socket.connected) return;
  try {
    socket.emit("action_result", { requestId, ...result });
  } catch {
    // ignore
  }
}

export function parseId(value: unknown): number {
  return Number(value);
}

export function parseOptionalRunId(payload: ActionPayload): number | undefined {
  const runId = payload.runId;
  if (runId == null) return undefined;
  return Number(runId);
}
