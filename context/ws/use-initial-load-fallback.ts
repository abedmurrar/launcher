"use client";

import { useEffect, useRef } from "react";
import type { CommandListItem, GroupListItem } from "./types";
import { createHttpListsFetcher } from "./adapters";
import { HTTP_FALLBACK_INITIAL_MS } from "./constants";

export type InitialLoadFallbackParams = {
  initialLoadDone: boolean;
  connectionError: boolean;
  setCommands: (commands: CommandListItem[]) => void;
  setGroups: (groups: GroupListItem[]) => void;
  setInitialLoadDone: (done: boolean) => void;
};

const listsFetcher = createHttpListsFetcher();

export function useInitialLoadFallback(
  params: InitialLoadFallbackParams
): void {
  const {
    initialLoadDone,
    connectionError,
    setCommands,
    setGroups,
    setInitialLoadDone,
  } = params;

  const httpFallbackAttemptedRef = useRef(false);

  useEffect(() => {
    if (initialLoadDone) return;

    const loadViaHttp = async (): Promise<void> => {
      if (httpFallbackAttemptedRef.current) return;
      httpFallbackAttemptedRef.current = true;

      try {
        const { commands: commandsList, groups: groupsList } =
          await listsFetcher.fetchLists();
        setCommands(commandsList);
        setGroups(groupsList);
        setInitialLoadDone(true);
      } catch {
        httpFallbackAttemptedRef.current = false;
      }
    };

    if (connectionError) {
      loadViaHttp();
      return;
    }

    const fallbackTimeoutId = setTimeout(
      loadViaHttp,
      HTTP_FALLBACK_INITIAL_MS
    );

    return () => clearTimeout(fallbackTimeoutId);
  }, [
    initialLoadDone,
    connectionError,
    setCommands,
    setGroups,
    setInitialLoadDone,
  ]);
}
