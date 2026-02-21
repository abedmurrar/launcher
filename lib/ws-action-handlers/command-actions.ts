import type { WebSocket } from "ws";
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
import { sendResult, parseId, parseOptionalRunId } from "./reply";

export function handleCommandAction(
  ws: WebSocket,
  type: string,
  requestId: string | undefined,
  payload: ActionPayload,
  reply: (result: ActionResult) => void
): void {
  switch (type) {
    case CommandAction.Run: {
      const commandId = parseId(payload.commandId);
      if (process.env.NODE_ENV === "development") {
        console.log("[run] commandId:", commandId);
      }
      const result = runCommand(commandId);
      if (process.env.NODE_ENV === "development") {
        console.log("[run] result:", result.success ? "ok" : result.error);
      }
      reply(result);
      break;
    }
    case CommandAction.Stop:
      reply(stopCommand(parseId(payload.commandId), parseOptionalRunId(payload)));
      break;
    case CommandAction.Restart:
      restartCommand(parseId(payload.commandId)).then(reply);
      break;
    case CommandAction.CreateCommand:
      reply(createCommand(payload.data));
      break;
    case CommandAction.UpdateCommand:
      reply(updateCommand(parseId(payload.id), (payload.data as ActionPayload) ?? {}));
      break;
    case CommandAction.DeleteCommand:
      reply(deleteCommand(parseId(payload.id)));
      break;
    default:
      break;
  }
}
