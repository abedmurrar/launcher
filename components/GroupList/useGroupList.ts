"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWs } from "@/context/ws";
import { useToast } from "@/components/shared/Toast";
import { GroupAction } from "@/lib/ws-action-handlers/types";

/**
 * Custom hook: encapsulates group list state and action handlers
 * (Hooks pattern – reusable stateful logic; Container uses this and passes to Presentational).
 */
type GroupRunAction = "run" | "stop" | "restart";

export function useGroupList() {
  const { groups, commands, initialLoadDone, connectionError, sendAction } = useWs();
  const { toast, confirm } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  /** In-flight run/stop/restart per group (other groups stay usable). */
  const [pending, setPending] = useState<Record<number, GroupRunAction>>({});
  /** After success, wait for the broadcast to reflect the change before re-enabling. */
  const awaitingRef = useRef(
    new Map<number, { action: GroupRunAction; prevRunId?: number; timer: ReturnType<typeof setTimeout> }>()
  );
  const [logGroupRunId, setLogGroupRunId] = useState<number | null>(null);

  const commandsForSelect = commands.map((c) => ({ id: c.id, name: c.name }));

  const clearPending = useCallback((groupId: number) => {
    const entry = awaitingRef.current.get(groupId);
    if (entry) clearTimeout(entry.timer);
    awaitingRef.current.delete(groupId);
    setPending((prev) => {
      if (!(groupId in prev)) return prev;
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }, []);

  useEffect(() => {
    awaitingRef.current.forEach((entry, groupId) => {
      const g = groups.find((x) => x.id === groupId);
      if (!g) return clearPending(groupId);
      const done =
        (entry.action === "run" && g.running) ||
        (entry.action === "stop" && !g.running) ||
        (entry.action === "restart" && g.running && g.running_group_run_id !== entry.prevRunId);
      if (done) clearPending(groupId);
    });
  }, [groups, clearPending]);

  useEffect(() => {
    const awaiting = awaitingRef.current;
    return () => awaiting.forEach((e) => clearTimeout(e.timer));
  }, []);

  const groupName = useCallback(
    (id: number) => groups.find((g) => g.id === id)?.name ?? `#${id}`,
    [groups]
  );

  const runGroupAction = useCallback(
    async (id: number, action: GroupRunAction, type: string, failMessage: string) => {
      setPending((prev) => ({ ...prev, [id]: action }));
      const prevRunId = groups.find((g) => g.id === id)?.running_group_run_id;
      const result = await sendAction(type, { groupId: id });
      if (!result.success) {
        toast(result.error ?? failMessage, "error");
        clearPending(id);
        return;
      }
      if ((result.data as { forced?: boolean } | undefined)?.forced) {
        toast(`Some commands in "${groupName(id)}" ignored SIGTERM and were force-killed`, "info");
      }
      const timer = setTimeout(() => clearPending(id), 3_000);
      awaitingRef.current.set(id, { action, prevRunId, timer });
    },
    [groups, sendAction, toast, clearPending, groupName]
  );

  const handleCreate = useCallback(
    async (name: string) => {
      const result = await sendAction(GroupAction.CreateGroup, { name });
      if (!result.success) {
        toast(result.error ?? "Failed to create", "error");
        return;
      }
      setShowForm(false);
    },
    [sendAction, toast]
  );

  const handleUpdateName = useCallback(
    async (id: number, name: string) => {
      const result = await sendAction(GroupAction.UpdateGroup, { id, data: { name } });
      if (!result.success) {
        toast(result.error ?? "Failed to update", "error");
        return;
      }
      setEditingId(null);
    },
    [sendAction, toast]
  );

  const handleSetCommands = useCallback(
    async (id: number, commandIds: number[]) => {
      const result = await sendAction(GroupAction.SetGroupCommands, {
        id,
        data: { commandIds },
      });
      if (!result.success) toast(result.error ?? "Failed to update commands", "error");
    },
    [sendAction, toast]
  );

  const handleRun = useCallback(
    (id: number) => runGroupAction(id, "run", GroupAction.RunGroup, "Failed to run group"),
    [runGroupAction]
  );

  const handleStop = useCallback(
    (id: number) => runGroupAction(id, "stop", GroupAction.StopGroup, "Failed to stop group"),
    [runGroupAction]
  );

  const handleRestart = useCallback(
    (id: number) => runGroupAction(id, "restart", GroupAction.RestartGroup, "Failed to restart group"),
    [runGroupAction]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirm(`Delete group "${groupName(id)}"?`, "Delete"))) return;
      const result = await sendAction(GroupAction.DeleteGroup, { id });
      if (!result.success) toast(result.error ?? "Failed to delete", "error");
    },
    [sendAction, toast, confirm, groupName]
  );

  const openCreateForm = useCallback(() => {
    setShowForm(true);
    setEditingId(null);
  }, []);

  const closeCreateForm = useCallback(() => setShowForm(false), []);

  const setEditing = useCallback((id: number | null) => setEditingId(id), []);

  const openGroupLogs = useCallback((groupRunId: number) => setLogGroupRunId(groupRunId), []);
  const closeGroupLogs = useCallback(() => setLogGroupRunId(null), []);

  return {
    groups,
    commandsForSelect,
    initialLoadDone,
    connectionError,
    showForm,
    editingId,
    pending,
    logGroupRunId,
    openCreateForm,
    closeCreateForm,
    setEditing,
    handleCreate,
    handleUpdateName,
    handleSetCommands,
    handleRun,
    handleStop,
    handleRestart,
    handleDelete,
    openGroupLogs,
    closeGroupLogs,
  };
}

export type UseGroupListReturn = ReturnType<typeof useGroupList>;
