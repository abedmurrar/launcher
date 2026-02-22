import type { CommandListItem, GroupListItem } from "../types";
import type { ListsFetcher, ListsResult } from "./lists-fetcher-types";
import { apiClient } from "@/lib/api";

/**
 * Adapter: fetches commands and groups via HTTP (axios) and exposes them as ListsResult.
 */
export function createHttpListsFetcher(): ListsFetcher {
  return {
    async fetchLists(): Promise<ListsResult> {
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

      return { commands, groups };
    },
  };
}
