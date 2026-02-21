import type {
  CommandListItem,
  GroupListItem,
  LogChunk,
  ActionResult,
  IncomingMessage,
} from "./types";
import { isActionResultMessage } from "./helpers";
import { updateCommandsAndNotify, updateGroupsAndNotify } from "./lists-update-subject";

export type MessageHandlerCallbacks = {
  setCommands: (commands: CommandListItem[]) => void;
  setGroups: (groups: GroupListItem[]) => void;
  setInitialLoadDone: (done: boolean) => void;
  setConnectionError: (error: boolean) => void;
  getLogSubscribers: () => Map<number, import("./types").LogCallbacks>;
  getPendingActions: () => Map<
    string,
    {
      resolve: (result: ActionResult) => void;
      type: string;
      payload: Record<string, unknown>;
    }
  >;
  doHttpAction: (type: string, payload: Record<string, unknown>) => Promise<ActionResult>;
};

export function handleIncomingMessage(
  message: IncomingMessage,
  callbacks: MessageHandlerCallbacks
): void {
  switch (message.type) {
    case "commands":
      if (Array.isArray(message.data)) {
        const commandsList = message.data as CommandListItem[];
        callbacks.setCommands(commandsList);
        updateCommandsAndNotify(commandsList);
        callbacks.setInitialLoadDone(true);
        callbacks.setConnectionError(false);
      }
      break;

    case "groups":
      if (Array.isArray(message.data)) {
        const groupsList = message.data as GroupListItem[];
        callbacks.setGroups(groupsList);
        updateGroupsAndNotify(groupsList);
      }
      break;

    case "log_history":
      if (typeof message.runId === "number" && Array.isArray(message.chunks)) {
        const logCallbacks = callbacks.getLogSubscribers().get(message.runId);
        logCallbacks?.onHistory?.(message.chunks as LogChunk[]);
      }
      break;

    case "log":
      if (
        typeof message.runId === "number" &&
        message.streamType &&
        message.data !== undefined
      ) {
        const logCallbacks = callbacks.getLogSubscribers().get(message.runId);
        logCallbacks?.onChunk(message.streamType, String(message.data));
      }
      break;

    case "log_finished":
      if (typeof message.runId === "number") {
        const logCallbacks = callbacks.getLogSubscribers().get(message.runId);
        logCallbacks?.onFinished?.();
        callbacks.getLogSubscribers().delete(message.runId);
      }
      break;

    default:
      if (isActionResultMessage(message) && message.requestId != null) {
        const pendingActions = callbacks.getPendingActions();
        const pendingEntry = pendingActions.get(message.requestId);
        if (pendingEntry != null && pendingActions.delete(message.requestId)) {
          const actionResult: ActionResult = {
            success: Boolean(message.success),
            data: message.data,
            error:
              typeof message.error === "string" ? message.error : undefined,
          };
          if (actionResult.success) {
            pendingEntry.resolve(actionResult);
          } else {
            callbacks
              .doHttpAction(pendingEntry.type, pendingEntry.payload)
              .then(pendingEntry.resolve);
          }
        }
      }
      break;
  }
}
