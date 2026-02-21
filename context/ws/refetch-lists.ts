import type { CommandListItem, GroupListItem } from "./types";
import { notifyListsUpdate } from "./lists-update-subject";

const API_BASE = "";

export async function refetchLists(
  onListsUpdated: (commands: CommandListItem[], groups: GroupListItem[]) => void
): Promise<void> {
  const [commandsResponse, groupsResponse] = await Promise.all([
    fetch(`${API_BASE}/api/commands`),
    fetch(`${API_BASE}/api/groups`),
  ]);

  const commands: CommandListItem[] = commandsResponse.ok
    ? ((await commandsResponse.json()) as CommandListItem[])
    : [];
  const groups: GroupListItem[] = groupsResponse.ok
    ? ((await groupsResponse.json()) as GroupListItem[])
    : [];

  onListsUpdated(commands, groups);
  notifyListsUpdate(commands, groups);
}
