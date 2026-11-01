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
import { parseId } from "./reply";

export async function handleGroupAction(type: string, payload: ActionPayload): Promise<ActionResult | null> {
  switch (type) {
    case GroupAction.CreateGroup:
      return createGroup((payload.data as ActionPayload) ?? { name: payload.name });
    case GroupAction.UpdateGroup:
      return updateGroup(parseId(payload.id), (payload.data as ActionPayload) ?? { name: payload.name });
    case GroupAction.DeleteGroup:
      return deleteGroup(parseId(payload.id));
    case GroupAction.SetGroupCommands:
      return setGroupCommands(
        parseId(payload.id),
        (payload.data as ActionPayload) ?? { commandIds: payload.commandIds ?? [] }
      );
    case GroupAction.RunGroup:
      return runGroup(parseId(payload.groupId));
    case GroupAction.StopGroup:
      return stopGroup(parseId(payload.groupId));
    case GroupAction.RestartGroup:
      return restartGroup(parseId(payload.groupId));
    default:
      return null;
  }
}
