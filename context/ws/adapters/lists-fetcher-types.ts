import type { CommandListItem, GroupListItem } from "../types";

export interface ListsResult {
  commands: CommandListItem[];
  groups: GroupListItem[];
}

export interface ListsFetcher {
  fetchLists(): Promise<ListsResult>;
}
