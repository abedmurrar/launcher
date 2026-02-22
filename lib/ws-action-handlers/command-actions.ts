import type { Socket } from "socket.io";
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

export async function handleCommandAction(
  socket: Socket,
  type: string,
  requestId: string | undefined,
  payload: ActionPayload,
  reply: (result: ActionResult) => void
): Promise<void> {
  switch (type) {
    case CommandAction.Run: {
      const commandId = parseId(payload.commandId);
      if (process.env.NODE_ENV === "development") {
        console.log("[run] commandId:", commandId);
      }
      const result = await runCommand(commandId);
      if (process.env.NODE_ENV === "development") {
        console.log("[run] result:", result.success ? "ok" : result.error);
      }
      reply(result);
      break;
    }
    case CommandAction.Stop:
      reply(await stopCommand(parseId(payload.commandId), parseOptionalRunId(payload)));
      break;
    case CommandAction.Restart:
      reply(await restartCommand(parseId(payload.commandId)));
      break;
    case CommandAction.CreateCommand:
      reply(await createCommand(payload.data));
      break;
    case CommandAction.UpdateCommand:
      reply(await updateCommand(parseId(payload.id), (payload.data as ActionPayload) ?? {}));
      break;
    case CommandAction.DeleteCommand:
      reply(await deleteCommand(parseId(payload.id)));
      break;
    default:
      break;
  }
}
