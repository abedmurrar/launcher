import type { CommandListItem, GroupListItem } from "./types";

export type ListsUpdateObserver = (
  commands: CommandListItem[],
  groups: GroupListItem[]
) => void;

/**
 * Observer pattern: subject for commands/groups list updates.
 * Holds latest lists and notifies observers when either is updated (refetch or WS).
 */
const observers = new Set<ListsUpdateObserver>();
let lastCommands: CommandListItem[] = [];
let lastGroups: GroupListItem[] = [];

function notify(): void {
  observers.forEach((observer) => observer(lastCommands, lastGroups));
}

export function subscribeListsUpdate(observer: ListsUpdateObserver): () => void {
  observers.add(observer);
  return () => {
    observers.delete(observer);
  };
}

export function notifyListsUpdate(
  commands: CommandListItem[],
  groups: GroupListItem[]
): void {
  lastCommands = commands;
  lastGroups = groups;
  notify();
}

/** Update commands only (e.g. from WS); notifies with latest commands + last groups. */
export function updateCommandsAndNotify(commands: CommandListItem[]): void {
  lastCommands = commands;
  notify();
}

/** Update groups only (e.g. from WS); notifies with last commands + latest groups. */
export function updateGroupsAndNotify(groups: GroupListItem[]): void {
  lastGroups = groups;
  notify();
}
