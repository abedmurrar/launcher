import type { CommandListItem, GroupListItem, ActionResult } from "../types";

export type ActionSender = (
  actionType: string,
  payload: Record<string, unknown>
) => Promise<ActionResult>;

export type OnListsUpdated = (
  commands: CommandListItem[],
  groups: GroupListItem[]
) => void;
