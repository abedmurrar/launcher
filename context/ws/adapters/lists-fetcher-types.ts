import type { CommandListItem, GroupListItem } from "../types";

export type ListsResult = {
  commands: CommandListItem[];
  groups: GroupListItem[];
};

export type ListsFetcher = {
  fetchLists(): Promise<ListsResult>;
};
