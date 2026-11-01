import type { Socket } from "socket.io-client";
import type { ActionResult } from "../types";
import type { ActionSender } from "./action-sender-types";

interface SocketIoActionSenderParams {
  /** Read at call time (not during render). */
  socketRef: { readonly current: Socket | null };
  timeoutMs: number;
  /** Used only when the socket is not connected, i.e. the action was never sent. */
  fallbackSender: ActionSender;
}

/**
 * Adapter: sends actions over Socket.IO with an acknowledgement.
 * The server's result is returned as-is (failures are NOT retried over HTTP, which would
 * execute the action twice). On ack timeout the outcome is unknown, so we report it rather
 * than re-sending.
 */
export function createSocketIoActionSender(params: SocketIoActionSenderParams): ActionSender {
  const { socketRef, timeoutMs, fallbackSender } = params;

  return async (actionType: string, payload: Record<string, unknown>): Promise<ActionResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return fallbackSender(actionType, payload);
    }
    try {
      const result = (await socket
        .timeout(timeoutMs)
        .emitWithAck("action", { type: actionType, ...payload })) as ActionResult;
      return {
        success: Boolean(result?.success),
        data: result?.data,
        error: typeof result?.error === "string" ? result.error : undefined,
        code: typeof result?.code === "number" ? result.code : undefined,
      };
    } catch {
      return {
        success: false,
        error: "The server did not respond in time; the action may still complete.",
      };
    }
  };
}
