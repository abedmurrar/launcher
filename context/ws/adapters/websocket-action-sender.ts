import type { ActionResult } from "../types";
import type { ActionSender } from "./action-sender-types";

export type WebSocketActionSenderParams = {
  sendOverWebSocket: (message: unknown) => void;
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
 * Adapter: sends actions over WebSocket and resolves via pending map;
 * on timeout or when WS is used elsewhere as fallback, delegates to fallbackSender.
 */
export function createWebSocketActionSender(
  params: WebSocketActionSenderParams
): ActionSender {
  const {
    sendOverWebSocket,
    getPendingActions,
    timeoutMs,
    fallbackSender,
  } = params;

  return (actionType: string, payload: Record<string, unknown>) =>
    new Promise((resolve) => {
      const requestId = crypto.randomUUID();
      const pending = getPendingActions();
      pending.set(requestId, { resolve, type: actionType, payload });

      sendOverWebSocket({ type: actionType, requestId, ...payload });

      setTimeout(() => {
        const entry = pending.get(requestId);
        if (entry != null && pending.delete(requestId)) {
          fallbackSender(entry.type, entry.payload).then(entry.resolve);
        }
      }, timeoutMs);
    });
}
