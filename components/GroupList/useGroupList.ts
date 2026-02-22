"use client";

import { useState, useCallback } from "react";
import { useWs } from "@/context/ws";
import { GroupAction } from "@/lib/ws-action-handlers/types";

/**
 * Custom hook: encapsulates group list state and action handlers
 * (Hooks pattern – reusable stateful logic; Container uses this and passes to Presentational).
 */
type GroupRunAction = "run" | "stop" | "restart";

export function useGroupList() {
  const { groups, commands, initialLoadDone, connectionError, sendAction } = useWs();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState<{ groupId: number; action: GroupRunAction } | null>(null);
  const [logGroupRunId, setLogGroupRunId] = useState<number | null>(null);

  const commandsForSelect = commands.map((c) => ({ id: c.id, name: c.name }));

  const handleCreate = useCallback(
    async (name: string) => {
      const result = await sendAction(GroupAction.CreateGroup, { name });
      if (!result.success) {
        alert(result.error ?? "Failed to create");
        return;
      }
      setShowForm(false);
    },
    [sendAction]
  );

  const handleUpdateName = useCallback(
    async (id: number, name: string) => {
      const result = await sendAction(GroupAction.UpdateGroup, { id, data: { name } });
      if (!result.success) {
        alert(result.error ?? "Failed to update");
        return;
      }
      setEditingId(null);
    },
    [sendAction]
  );

  const handleSetCommands = useCallback(
    async (id: number, commandIds: number[]) => {
      const result = await sendAction(GroupAction.SetGroupCommands, {
        id,
        data: { commandIds },
      });
      if (!result.success) alert(result.error ?? "Failed to update commands");
    },
    [sendAction]
  );

  const handleRun = useCallback(
    async (id: number) => {
      setLoading({ groupId: id, action: "run" });
      try {
        const result = await sendAction(GroupAction.RunGroup, { groupId: id });
        if (!result.success) alert(result.error ?? "Failed to run group");
      } finally {
        setLoading(null);
      }
    },
    [sendAction]
  );

  const handleStop = useCallback(
    async (id: number) => {
      setLoading({ groupId: id, action: "stop" });
      try {
        const result = await sendAction(GroupAction.StopGroup, { groupId: id });
        if (!result.success) alert(result.error ?? "Failed to stop group");
      } finally {
        setLoading(null);
      }
    },
    [sendAction]
  );

  const handleRestart = useCallback(
    async (id: number) => {
      setLoading({ groupId: id, action: "restart" });
      try {
        const result = await sendAction(GroupAction.RestartGroup, { groupId: id });
        if (!result.success) alert(result.error ?? "Failed to restart group");
      } finally {
        setLoading(null);
      }
    },
    [sendAction]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("Delete this group?")) return;
      const result = await sendAction(GroupAction.DeleteGroup, { id });
      if (!result.success) alert(result.error ?? "Failed to delete");
    },
    [sendAction]
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
    loading,
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
