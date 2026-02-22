import type { CommandListItem, GroupListItem } from "./types";
import { notifyListsUpdate } from "./lists-update-subject";
import { apiClient } from "@/lib/api";

export async function refetchLists(
  onListsUpdated: (commands: CommandListItem[], groups: GroupListItem[]) => void
): Promise<void> {
  const [commandsRes, groupsRes] = await Promise.all([
    apiClient.get<CommandListItem[]>("/api/commands"),
    apiClient.get<GroupListItem[]>("/api/groups"),
  ]);

  const commands: CommandListItem[] =
    commandsRes.status >= 200 && commandsRes.status < 300
      ? (commandsRes.data ?? [])
      : [];
  const groups: GroupListItem[] =
    groupsRes.status >= 200 && groupsRes.status < 300
      ? (groupsRes.data ?? [])
      : [];

  onListsUpdated(commands, groups);
  notifyListsUpdate(commands, groups);
}
