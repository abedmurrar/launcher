import type { CommandListItem, GroupListItem, IncomingMessage, LogCallbacks, RestoreOffer } from "./types";
import { updateCommandsAndNotify, updateGroupsAndNotify } from "./lists-update-subject";

export interface MessageHandlerCallbacks {
  setCommands: (commands: CommandListItem[]) => void;
  setGroups: (groups: GroupListItem[]) => void;
  setInitialLoadDone: (done: boolean) => void;
  setConnectionError: (error: boolean) => void;
  getLogSubscribers: () => Map<number, LogCallbacks>;
  setRestoreOffers: (offers: RestoreOffer[]) => void;
  setInstanceId: (id: string) => void;
  markSynced: () => void;
}

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
        callbacks.markSynced();
      }
      break;

    case "restore_offers":
      if (Array.isArray(message.data)) callbacks.setRestoreOffers(message.data as RestoreOffer[]);
      break;

    case "hello":
      if (typeof message.instanceId === "string") callbacks.setInstanceId(message.instanceId);
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
        callbacks.getLogSubscribers().get(message.runId)?.onHistory?.(message.chunks, {
          truncated: Boolean(message.truncated),
          lastId: typeof message.lastId === "number" ? message.lastId : 0,
          firstId: typeof message.firstId === "number" ? message.firstId : 0,
          live: message.live !== false,
        });
      }
      break;

    case "log_batch":
      if (typeof message.runId === "number" && Array.isArray(message.chunks)) {
        callbacks
          .getLogSubscribers()
          .get(message.runId)
          ?.onBatch(message.chunks, typeof message.lastId === "number" ? message.lastId : undefined);
      }
      break;

    case "log_finished":
      if (typeof message.runId === "number") {
        callbacks.getLogSubscribers().get(message.runId)?.onFinished();
      }
      break;
  }
}
