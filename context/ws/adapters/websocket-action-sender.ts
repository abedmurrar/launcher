import type { Socket } from "socket.io-client";
import type { ActionResult } from "../types";
import type { ActionSender } from "./action-sender-types";

export type SocketIoActionSenderParams = {
  getSocket: () => Socket | null;
  getPendingActions: () => Map<
    string,
    {
      resolve: (result: ActionResult) => void;
      type: string;
      payload: Record<string, unknown>;
    }
  >;
  timeoutMs: number;
  fallbackSender: ActionSender;
};

/**
 * Adapter: sends actions over Socket.IO ("action" event) and resolves via pending map
 * when "action_result" is received; on timeout or when socket unavailable, uses fallbackSender.
 */
export function createSocketIoActionSender(
  params: SocketIoActionSenderParams
): ActionSender {
  const { getSocket, getPendingActions, timeoutMs, fallbackSender } = params;

  return (actionType: string, payload: Record<string, unknown>) =>
    new Promise((resolve) => {
      const socket = getSocket();
      if (!socket?.connected) {
        fallbackSender(actionType, payload).then(resolve);
        return;
      }

      const requestId = crypto.randomUUID();
      const pending = getPendingActions();
      pending.set(requestId, { resolve, type: actionType, payload });

      socket.emit("action", { type: actionType, requestId, ...payload });

      setTimeout(() => {
        const entry = pending.get(requestId);
        if (entry != null && pending.delete(requestId)) {
          fallbackSender(entry.type, entry.payload).then(entry.resolve);
        }
      }, timeoutMs);
    });
}
