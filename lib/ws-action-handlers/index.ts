import type { ActionType, ActionPayload, ActionResult } from "./types";
import { COMMAND_ACTIONS_LIST } from "./types";
import { handleCommandAction } from "./command-actions";
import { handleGroupAction } from "./group-actions";
import { ActionResultFactory } from "@/lib/actions/result-factory";

export {
  ACTION_TYPES,
  CommandAction,
  COMMAND_ACTIONS_LIST,
  GroupAction,
  type ActionType,
  type CommandActionType,
  type GroupActionType,
  isActionType,
} from "./types";

/** Execute an action and return its result (never throws). */
export async function handleAction(type: ActionType, payload: ActionPayload): Promise<ActionResult> {
  try {
    const result = (COMMAND_ACTIONS_LIST as readonly string[]).includes(type)
      ? await handleCommandAction(type, payload)
      : await handleGroupAction(type, payload);
    return result ?? ActionResultFactory.error("Unknown action", 400);
  } catch (err) {
    console.error(`[ws] action ${type} failed:`, err);
    return ActionResultFactory.error(err instanceof Error ? err.message : "Unknown error", 500);
  }
}
