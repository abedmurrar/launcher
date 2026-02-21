import type { Socket } from "socket.io";
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

export function handleSocketConnection(socket: Socket): void {
  socket.on("initial", () => {
    sendInitialDump(socket);
  });

  socket.on("subscribe_logs", (runId: unknown) => {
    if (typeof runId === "number") {
      subscribeLogs(socket, runId);
    }
  });

  socket.on("unsubscribe_logs", (runId: unknown) => {
    if (typeof runId === "number") {
      unsubscribeLogs(socket, runId);
    }
  });

  socket.on("action", (payload: unknown) => {
    const msg = payload as IncomingMessage;
    if (!msg || typeof msg.type !== "string") return;
    if (isActionType(msg.type)) {
      handleAction(
        socket,
        msg.type,
        msg.requestId,
        msg as Record<string, unknown>
      );
    }
  });
}
