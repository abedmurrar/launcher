import type { CommandListItem, GroupListItem, ActionResult } from "../types";
import { CommandAction, GroupAction } from "@/lib/ws-action-handlers/types";
import {
  runCommandHttp,
  stopCommandHttp,
  restartCommandHttp,
  createCommandHttp,
  updateCommandHttp,
  deleteCommandHttp,
} from "./command-actions";
import {
  createGroupHttp,
  updateGroupHttp,
  deleteGroupHttp,
  setGroupCommandsHttp,
  runGroupHttp,
} from "./group-actions";

type OnListsUpdated = (commands: CommandListItem[], groups: GroupListItem[]) => void;

export async function fetchAction(
  actionType: string,
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  try {
    switch (actionType) {
      case CommandAction.Run:
        return runCommandHttp(payload, onListsUpdated);
      case CommandAction.Stop:
        return stopCommandHttp(payload, onListsUpdated);
      case CommandAction.Restart:
        return restartCommandHttp(payload, onListsUpdated);
      case CommandAction.CreateCommand:
        return createCommandHttp(payload, onListsUpdated);
      case CommandAction.UpdateCommand:
        return updateCommandHttp(payload, onListsUpdated);
      case CommandAction.DeleteCommand:
        return deleteCommandHttp(payload, onListsUpdated);
      case GroupAction.CreateGroup:
        return createGroupHttp(payload, onListsUpdated);
      case GroupAction.UpdateGroup:
        return updateGroupHttp(payload, onListsUpdated);
      case GroupAction.DeleteGroup:
        return deleteGroupHttp(payload, onListsUpdated);
      case GroupAction.SetGroupCommands:
        return setGroupCommandsHttp(payload, onListsUpdated);
      case GroupAction.RunGroup:
        return runGroupHttp(payload, onListsUpdated);
      default:
        return { success: false, error: "Unknown action" };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Request failed";
    return { success: false, error: errorMessage };
  }
}

/**
 * Facade: single entry point for executing actions over HTTP (commands + groups).
 */
export const httpActionsFacade = {
  execute: fetchAction,
} as const;
