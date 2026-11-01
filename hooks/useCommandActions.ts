"use client";

import { useCallback } from "react";
import { useWs } from "@/context/ws";
import { useToast } from "@/components/shared/Toast";
import { CommandAction } from "@/lib/ws-action-handlers/types";
import type { CommandFormData } from "@/components/CommandForm";

/** Command actions with toast feedback. Each resolves to whether it succeeded. */
export function useCommandActions() {
  const { commands, sendAction } = useWs();
  const { toast, confirm } = useToast();

  const nameOf = useCallback(
    (id: number) => commands.find((c) => c.id === id)?.name ?? `#${id}`,
    [commands]
  );

  const run = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Run, { commandId: id });
      if (!result.success) toast(result.error ?? "Failed to run", "error");
      return result.success;
    },
    [sendAction, toast]
  );

  const stop = useCallback(
    async (id: number, runId?: number) => {
      const result = await sendAction(CommandAction.Stop, {
        commandId: id,
        ...(runId != null ? { runId } : {}),
      });
      if (!result.success) toast(result.error ?? "Failed to stop", "error");
      else if ((result.data as { forced?: boolean } | undefined)?.forced) {
        toast(`"${nameOf(id)}" ignored SIGTERM and was force-killed`, "info");
      }
      return result.success;
    },
    [sendAction, toast, nameOf]
  );

  const restart = useCallback(
    async (id: number) => {
      const result = await sendAction(CommandAction.Restart, { commandId: id });
      if (!result.success) toast(result.error ?? "Failed to restart", "error");
      return result.success;
    },
    [sendAction, toast]
  );

  /** Resolves to the new command's id, or null on failure. */
  const create = useCallback(
    async (data: CommandFormData): Promise<number | null> => {
      const result = await sendAction(CommandAction.CreateCommand, { data });
      if (!result.success) {
        toast(result.error ?? "Failed to create", "error");
        return null;
      }
      return (result.data as { id?: number } | undefined)?.id ?? null;
    },
    [sendAction, toast]
  );

  const update = useCallback(
    async (id: number, data: CommandFormData) => {
      const result = await sendAction(CommandAction.UpdateCommand, { id, data });
      if (!result.success) toast(result.error ?? "Failed to update", "error");
      return result.success;
    },
    [sendAction, toast]
  );

  const remove = useCallback(
    async (id: number) => {
      if (!(await confirm(`Delete "${nameOf(id)}"?`, "Delete"))) return false;
      const result = await sendAction(CommandAction.DeleteCommand, { id });
      if (!result.success) toast(result.error ?? "Failed to delete", "error");
      return result.success;
    },
    [sendAction, toast, confirm, nameOf]
  );

  return { run, stop, restart, create, update, remove };
}
