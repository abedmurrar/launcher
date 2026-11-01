"use client";

import { useEffect } from "react";
import type { CommandListItem, GroupListItem } from "./types";
import { createHttpListsFetcher } from "./adapters";
import { POLL_INTERVAL_MS, POLL_INTERVAL_MAX_MS } from "./constants";

export interface PollingWhenDisconnectedParams {
  ready: boolean;
  setCommands: (commands: CommandListItem[]) => void;
  setGroups: (groups: GroupListItem[]) => void;
  setInitialLoadDone: (done: boolean) => void;
}

const listsFetcher = createHttpListsFetcher();

/**
 * While the socket is down, poll the list endpoints with exponential backoff
 * (POLL_INTERVAL_MS → POLL_INTERVAL_MAX_MS), pausing while the tab is hidden.
 */
export function usePollingWhenDisconnected(params: PollingWhenDisconnectedParams): void {
  const { ready, setCommands, setGroups, setInitialLoadDone } = params;

  useEffect(() => {
    if (ready) return;

    let cancelled = false;
    let delay = POLL_INTERVAL_MS;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(poll, delay);
      delay = Math.min(delay * 2, POLL_INTERVAL_MAX_MS);
    };

    const poll = async (): Promise<void> => {
      timer = null;
      if (cancelled) return;
      if (document.hidden) return; // resumed by visibilitychange
      try {
        const { commands, groups } = await listsFetcher.fetchLists();
        if (cancelled) return;
        setCommands(commands);
        setGroups(groups);
        setInitialLoadDone(true);
      } catch {
        // ignore; retry with backoff
      }
      schedule();
    };

    const onVisibility = () => {
      if (!document.hidden && timer === null) {
        delay = POLL_INTERVAL_MS;
        void poll();
      }
    };

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ready, setCommands, setGroups, setInitialLoadDone]);
}
