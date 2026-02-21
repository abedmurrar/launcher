import type { WebSocket } from "ws";
import type { ActionType, ActionPayload, ActionResult } from "./types";
import { isActionType, COMMAND_ACTIONS_LIST } from "./types";
import { sendResult } from "./reply";
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

export async function handleAction(
  ws: WebSocket,
  type: ActionType,
  requestId: string | undefined,
  payload: ActionPayload
): Promise<void> {
  const reply = (result: ActionResult) => sendResult(ws, type, requestId, result);

  try {
    if ((COMMAND_ACTIONS_LIST as readonly string[]).includes(type)) {
      handleCommandAction(ws, type, requestId, payload, reply);
    } else {
      handleGroupAction(ws, type, requestId, payload, reply);
    }
  } catch (err) {
    reply(
      ActionResultFactory.error(err instanceof Error ? err.message : "Unknown error")
    );
  }
}
