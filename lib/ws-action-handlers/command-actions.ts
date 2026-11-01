import {
  runCommand,
  stopCommand,
  restartCommand,
  createCommand,
  updateCommand,
  deleteCommand,
} from "@/lib/actions/commands";
import type { ActionPayload, ActionResult } from "./types";
import { CommandAction } from "./types";
import { parseId, parseOptionalRunId } from "./reply";

export async function handleCommandAction(type: string, payload: ActionPayload): Promise<ActionResult | null> {
  switch (type) {
    case CommandAction.Run:
      return runCommand(parseId(payload.commandId));
    case CommandAction.Stop:
      return stopCommand(parseId(payload.commandId), parseOptionalRunId(payload));
    case CommandAction.Restart:
      return restartCommand(parseId(payload.commandId));
    case CommandAction.CreateCommand:
      return createCommand(payload.data);
    case CommandAction.UpdateCommand:
      return updateCommand(parseId(payload.id), (payload.data as ActionPayload) ?? {});
    case CommandAction.DeleteCommand:
      return deleteCommand(parseId(payload.id));
    default:
      return null;
  }
}
