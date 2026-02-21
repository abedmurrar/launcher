import type { Socket } from "socket.io";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupCommands,
  runGroup,
} from "@/lib/actions/groups";
import type { ActionPayload, ActionResult } from "./types";
import { GroupAction } from "./types";
import { sendResult, parseId } from "./reply";

export function handleGroupAction(
  socket: Socket,
  type: string,
  requestId: string | undefined,
  payload: ActionPayload,
  reply: (result: ActionResult) => void
): void {
  switch (type) {
    case GroupAction.CreateGroup:
      reply(createGroup((payload.data as ActionPayload) ?? { name: payload.name }));
      break;
    case GroupAction.UpdateGroup:
      reply(updateGroup(parseId(payload.id), (payload.data as ActionPayload) ?? { name: payload.name }));
      break;
    case GroupAction.DeleteGroup:
      reply(deleteGroup(parseId(payload.id)));
      break;
    case GroupAction.SetGroupCommands:
      reply(
        setGroupCommands(parseId(payload.id), (payload.data as ActionPayload) ?? { commandIds: payload.commandIds ?? [] })
      );
      break;
    case GroupAction.RunGroup:
      reply(runGroup(parseId(payload.groupId)));
      break;
    default:
      break;
  }
}
