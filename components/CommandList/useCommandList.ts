"use client";

import { useState, useCallback } from "react";
import { useWs } from "@/context/ws";
import { CommandAction } from "@/lib/ws-action-handlers/types";
import type { CommandListItem } from "@/context/ws";
import type { CommandFormData } from "@/components/CommandForm";

/**
 * Custom hook: encapsulates command list state and action handlers
 * (Hooks pattern – reusable stateful logic; Container uses this and passes to Presentational).
 */
export function useCommandList() {
  const { commands, initialLoadDone, connectionError, sendAction } = useWs();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logRunId, setLogRunId] = useState<number | null>(null);

  const handleRun = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Run, { commandId: id });
      if (!result.success) alert(result.error ?? "Failed to run");
    },
    [sendAction]
  );

  const handleStop = useCallback(
    async (id: number, runId?: number) => {
      const result = await sendAction(CommandAction.Stop, {
        commandId: id,
        ...(runId != null ? { runId } : {}),
      });
      if (!result.success) alert(result.error ?? "Failed to stop");
    },
    [sendAction]
  );

  const handleRestart = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Restart, { commandId: id });
      if (!result.success) alert(result.error ?? "Failed to restart");
    },
    [sendAction]
  );

  const handleCreate = useCallback(
    async (data: CommandFormData) => {
      const result = await sendAction(CommandAction.CreateCommand, { data });
      if (!result.success) {
        alert(result.error ?? "Failed to create");
        return;
      }
      setShowForm(false);
    },
    [sendAction]
  );

  const handleUpdate = useCallback(
    async (id: number, data: CommandFormData) => {
      const result = await sendAction(CommandAction.UpdateCommand, { id, data });
      if (!result.success) {
        alert(result.error ?? "Failed to update");
        return;
      }
      setEditingId(null);
    },
    [sendAction]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm("Delete this command?")) return;
      const result = await sendAction(CommandAction.DeleteCommand, { id });
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

  const openLogs = useCallback((runId: number) => setLogRunId(runId), []);
  const closeLogs = useCallback(() => setLogRunId(null), []);

  return {
    commands,
    initialLoadDone,
    connectionError,
    showForm,
    editingId,
    logRunId,
    openCreateForm,
    closeCreateForm,
    setEditing,
    openLogs,
    closeLogs,
    handleRun,
    handleStop,
    handleRestart,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}

export type UseCommandListReturn = ReturnType<typeof useCommandList>;
