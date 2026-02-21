import type { CommandListItem, GroupListItem } from "../types";
import type { ListsFetcher, ListsResult } from "./lists-fetcher-types";

const API_BASE = "";

/**
 * Adapter: fetches commands and groups via HTTP and exposes them as ListsResult.
 */
export function createHttpListsFetcher(): ListsFetcher {
  return {
    async fetchLists(): Promise<ListsResult> {
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

      return { commands, groups };
    },
  };
}
