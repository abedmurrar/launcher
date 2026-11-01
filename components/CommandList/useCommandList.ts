"use client";

import { useState, useCallback } from "react";
import { useWs } from "@/context/ws";
import { useToast } from "@/components/shared/Toast";
import { CommandAction } from "@/lib/ws-action-handlers/types";
import type { CommandListItem } from "@/context/ws";
import type { CommandFormData } from "@/components/CommandForm";

/**
 * Custom hook: encapsulates command list state and action handlers
 * (Hooks pattern – reusable stateful logic; Container uses this and passes to Presentational).
 */
export function useCommandList() {
  const { commands, initialLoadDone, connectionError, sendAction } = useWs();
  const { toast, confirm } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logRunId, setLogRunId] = useState<number | null>(null);

  const nameOf = useCallback(
    (id: number) => commands.find((c) => c.id === id)?.name ?? `#${id}`,
    [commands]
  );

  const handleRun = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Run, { commandId: id });
      if (!result.success) toast(result.error ?? "Failed to run", "error");
      return result.success;
    },
    [sendAction, toast]
  );

  const handleStop = useCallback(
    async (id: number, runId?: number) => {
      const result = await sendAction(CommandAction.Stop, {
        commandId: id,
        ...(runId != null ? { runId } : {}),
      });
      if (!result.success) {
        toast(result.error ?? "Failed to stop", "error");
      } else if ((result.data as { forced?: boolean } | undefined)?.forced) {
        toast(`"${nameOf(id)}" ignored SIGTERM and was force-killed`, "info");
      }
      return result.success;
    },
    [sendAction, toast, nameOf]
  );

  const handleRestart = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Restart, { commandId: id });
      if (!result.success) toast(result.error ?? "Failed to restart", "error");
      return result.success;
    },
    [sendAction, toast]
  );

  const handleCreate = useCallback(
    async (data: CommandFormData) => {
      const result = await sendAction(CommandAction.CreateCommand, { data });
      if (!result.success) {
        toast(result.error ?? "Failed to create", "error");
        return;
      }
      setShowForm(false);
    },
    [sendAction, toast]
  );

  const handleUpdate = useCallback(
    async (id: number, data: CommandFormData) => {
      const result = await sendAction(CommandAction.UpdateCommand, { id, data });
      if (!result.success) {
        toast(result.error ?? "Failed to update", "error");
        return;
      }
      setEditingId(null);
    },
    [sendAction, toast]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirm(`Delete "${nameOf(id)}"?`, "Delete"))) return;
      const result = await sendAction(CommandAction.DeleteCommand, { id });
      if (!result.success) toast(result.error ?? "Failed to delete", "error");
    },
    [sendAction, toast, confirm, nameOf]
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
