"use client";

import { RunControls } from "@/components/RunControls";
import { CommandForm } from "@/components/CommandForm";
import { LogViewer } from "@/components/LogViewer";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import type { CommandListItem } from "@/context/ws";
import type { CommandFormData } from "@/components/CommandForm";
import type { UseCommandListReturn } from "./useCommandList";

/**
 * Presentational: renders command list UI from props only (no hooks, no sendAction).
 */
export function CommandListView(props: UseCommandListReturn) {
  const {
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
  } = props;

  return (
    <ConnectionStatus initialLoadDone={initialLoadDone} connectionError={connectionError}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Commands</h2>
          <button
            type="button"
            onClick={openCreateForm}
            className="px-3 py-1.5 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            + Add command
          </button>
        </div>

        {showForm && !editingId && (
          <div className="p-4 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
            <CommandForm onSubmit={handleCreate} onCancel={closeCreateForm} />
          </div>
        )}

        <ul className="space-y-3">
          {commands.map((c) => (
            <CommandListItemView
              key={c.id}
              command={c}
              isEditing={editingId === c.id}
              onEdit={() => setEditing(c.id)}
              onCancelEdit={() => setEditing(null)}
              onUpdate={(data) => handleUpdate(c.id, data)}
              onDelete={() => handleDelete(c.id)}
              onRun={() => handleRun(c.id)}
              onStop={() => handleStop(c.id, c.run_id)}
              onRestart={() => handleRestart(c.id)}
              onLogs={openLogs}
            />
          ))}
        </ul>

        {commands.length === 0 && !showForm && (
          <p className="text-zinc-500">No commands yet. Add one to get started.</p>
        )}

        {logRunId != null && <LogViewer runId={logRunId} onClose={closeLogs} />}
      </div>
    </ConnectionStatus>
  );
}

function CommandListItemView({
  command: c,
  isEditing,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
  onRun,
  onStop,
  onRestart,
  onLogs,
}: {
  command: CommandListItem;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (data: CommandFormData) => Promise<void>;
  onDelete: () => void;
  onRun: () => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onRestart: () => Promise<unknown>;
  onLogs: (runId: number) => void;
}) {
  if (isEditing) {
    return (
      <li className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
        <CommandForm
          initial={{ name: c.name, command: c.command, cwd: c.cwd, env: c.env }}
          onSubmit={(data) => onUpdate(data)}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }
  return (
    <li className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
          {c.running && (
            <span className="ml-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">running</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={c.running}
            className="px-2 py-1 text-sm rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title={c.running ? "Stop the command first to edit" : undefined}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={c.running}
            className="px-2 py-1 text-sm rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            title={c.running ? "Stop the command first to delete" : undefined}
          >
            Delete
          </button>
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400 truncate" title={c.command}>
        {c.command}
      </p>
      {c.cwd && (
        <p className="mt-0.5 font-mono text-xs text-zinc-500 dark:text-zinc-500">cwd: {c.cwd}</p>
      )}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {c.last_run_at != null && (
          <span className="text-xs text-zinc-500 dark:text-zinc-500">
            Last run: {new Date(c.last_run_at).toLocaleString()}
            {c.last_exit_code != null && ` (exit ${c.last_exit_code})`}
          </span>
        )}
        <RunControls
          commandId={c.id}
          runId={c.run_id}
          lastRunId={c.last_run_id}
          pid={c.pid}
          running={c.running}
          onRun={onRun}
          onStop={onStop}
          onRestart={onRestart}
          onLogs={onLogs}
        />
      </div>
    </li>
  );
}
