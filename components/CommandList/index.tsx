"use client";

import { useCommandList } from "./useCommandList";
import { CommandListView } from "./CommandListView";

/**
 * Container: uses useCommandList (hooks pattern) and delegates rendering to CommandListView (presentational).
 */
export function CommandList() {
  const hookState = useCommandList();
  return <CommandListView {...hookState} />;
}
