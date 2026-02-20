"use client";

import { useState } from "react";
import { useWs } from "@/context/ws-context";
import { RunControls } from "./RunControls";
import { CommandForm, type CommandFormData } from "./CommandForm";
import { LogViewer } from "./LogViewer";

export function CommandList() {
  const { commands, initialLoadDone, sendAction } = useWs();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logRunId, setLogRunId] = useState<number | null>(null);

  const handleRun = async (id: number) => {
    const result = await sendAction("run", { commandId: id });
    if (!result.success) alert(result.error ?? "Failed to run");
  };

  const handleStop = async (id: number, runId?: number) => {
    const result = await sendAction("stop", { commandId: id, ...(runId != null ? { runId } : {}) });
    if (!result.success) alert(result.error ?? "Failed to stop");
  };

  const handleRestart = async (id: number) => {
    const result = await sendAction("restart", { commandId: id });
    if (!result.success) alert(result.error ?? "Failed to restart");
  };

  const handleCreate = async (data: CommandFormData) => {
    const result = await sendAction("create_command", { data });
    if (!result.success) {
      alert(result.error ?? "Failed to create");
      return;
    }
    setShowForm(false);
  };

  const handleUpdate = async (id: number, data: CommandFormData) => {
    const result = await sendAction("update_command", { id, data });
    if (!result.success) {
      alert(result.error ?? "Failed to update");
      return;
    }
    setEditingId(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this command?")) return;
    const result = await sendAction("delete_command", { id });
    if (!result.success) alert(result.error ?? "Failed to delete");
  };

  if (!initialLoadDone) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Commands</h2>
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="px-3 py-1.5 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300"
        >
          + Add command
        </button>
      </div>

      {showForm && !editingId && (
        <div className="p-4 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
          <CommandForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <ul className="space-y-3">
        {commands.map((c) => (
          <li
            key={c.id}
            className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
          >
            {editingId === c.id ? (
              <div>
                <CommandForm
                  initial={{ name: c.name, command: c.command, cwd: c.cwd, env: c.env }}
                  onSubmit={(data) => handleUpdate(c.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</span>
                    {c.running && (
                      <span className="ml-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        running
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(c.id)}
                      className="px-2 py-1 text-sm rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="px-2 py-1 text-sm rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
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
                    onRun={() => handleRun(c.id)}
                    onStop={() => handleStop(c.id, c.run_id)}
                    onRestart={() => handleRestart(c.id)}
                    onLogs={setLogRunId}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {commands.length === 0 && !showForm && (
        <p className="text-zinc-500">No commands yet. Add one to get started.</p>
      )}

      {logRunId != null && (
        <LogViewer runId={logRunId} onClose={() => setLogRunId(null)} />
      )}
    </div>
  );
}
