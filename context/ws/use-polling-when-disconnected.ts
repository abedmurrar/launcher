"use client";

import { useEffect } from "react";
import type { CommandListItem, GroupListItem } from "./types";
import { createHttpListsFetcher } from "./adapters";
import { POLL_INTERVAL_MS } from "./constants";

export type PollingWhenDisconnectedParams = {
  ready: boolean;
  setCommands: (commands: CommandListItem[]) => void;
  setGroups: (groups: GroupListItem[]) => void;
  setInitialLoadDone: (done: boolean) => void;
};

const listsFetcher = createHttpListsFetcher();

export function usePollingWhenDisconnected(
  params: PollingWhenDisconnectedParams
): void {
  const { ready, setCommands, setGroups, setInitialLoadDone } = params;

  useEffect(() => {
    if (ready) return;

    const poll = async (): Promise<void> => {
      try {
        const { commands: commandsList, groups: groupsList } =
          await listsFetcher.fetchLists();
        setCommands(commandsList);
        setGroups(groupsList);
        setInitialLoadDone(true);
      } catch {
        // ignore
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [ready, setCommands, setGroups, setInitialLoadDone]);
}
