import type { Socket } from "socket.io";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupCommands,
  runGroup,
  stopGroup,
  restartGroup,
} from "@/lib/actions/groups";
import type { ActionPayload, ActionResult } from "./types";
import { GroupAction } from "./types";
import { sendResult, parseId } from "./reply";

export async function handleGroupAction(
  socket: Socket,
  type: string,
  requestId: string | undefined,
  payload: ActionPayload,
  reply: (result: ActionResult) => void
): Promise<void> {
  switch (type) {
    case GroupAction.CreateGroup:
      reply(await createGroup((payload.data as ActionPayload) ?? { name: payload.name }));
      break;
    case GroupAction.UpdateGroup:
      reply(await updateGroup(parseId(payload.id), (payload.data as ActionPayload) ?? { name: payload.name }));
      break;
    case GroupAction.DeleteGroup:
      reply(await deleteGroup(parseId(payload.id)));
      break;
    case GroupAction.SetGroupCommands:
      reply(
        await setGroupCommands(parseId(payload.id), (payload.data as ActionPayload) ?? { commandIds: payload.commandIds ?? [] })
      );
      break;
    case GroupAction.RunGroup:
      reply(await runGroup(parseId(payload.groupId)));
      break;
    case GroupAction.StopGroup:
      reply(await stopGroup(parseId(payload.groupId)));
      break;
    case GroupAction.RestartGroup:
      reply(await restartGroup(parseId(payload.groupId)));
      break;
    default:
      break;
  }
}
