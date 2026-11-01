import type { Socket } from "socket.io";
import { sendInitialDump, subscribeLogs, unsubscribeLogs } from "../lib/ws-broadcast";
import { handleAction, isActionType } from "../lib/ws-action-handlers";
import type { ActionResult } from "../lib/ws-action-handlers/types";

type Ack = (result: ActionResult) => void;

export function handleSocketConnection(socket: Socket): void {
  socket.on("initial", () => {
    void sendInitialDump(socket);
  });

  socket.on("subscribe_logs", (runId: unknown) => {
    if (typeof runId === "number" && Number.isInteger(runId)) {
      subscribeLogs(socket, runId);
    }
  });

  socket.on("unsubscribe_logs", (runId: unknown) => {
    if (typeof runId === "number" && Number.isInteger(runId)) {
      unsubscribeLogs(socket, runId);
    }
  });

  /** Actions are acknowledged via the Socket.IO ack callback (no request-id bookkeeping). */
  socket.on("action", (payload: unknown, ack?: unknown) => {
    const reply: Ack = typeof ack === "function" ? (ack as Ack) : () => {};
    const msg = payload as { type?: unknown } | null;
    if (!msg || typeof msg.type !== "string" || !isActionType(msg.type)) {
      reply({ success: false, error: "Unknown action", code: 400 });
      return;
    }
    void handleAction(msg.type, msg as Record<string, unknown>).then(reply);
  });
}
