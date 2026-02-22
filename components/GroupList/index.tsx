"use client";

import { useGroupList } from "./useGroupList";
import { GroupListView } from "./GroupListView";

/**
 * Container: uses useGroupList (hooks pattern) and delegates rendering to GroupListView (presentational).
 */
export function GroupList() {
  const hookState = useGroupList();
  return <GroupListView {...hookState} />;
}
