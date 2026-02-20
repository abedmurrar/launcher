"use client";

import { useState, useEffect, useCallback } from "react";
import { RunControls } from "./RunControls";
import { CommandForm, type CommandFormData } from "./CommandForm";
import { LogViewer } from "./LogViewer";

type CommandItem = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  running: boolean;
  run_id?: number;
  last_run_id?: number;
  pid?: number;
};

export function CommandList() {
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [logRunId, setLogRunId] = useState<number | null>(null);

  const fetchCommands = useCallback(async () => {
    const res = await fetch("/api/commands");
    if (res.ok) {
      const data = await res.json();
      setCommands(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCommands();
    const t = setInterval(fetchCommands, 3000);
    return () => clearInterval(t);
  }, [fetchCommands]);

  const handleRun = async (id: number) => {
    const res = await fetch(`/api/commands/${id}/run`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to run");
      return;
    }
    await fetchCommands();
  };

  const handleStop = async (id: number, runId?: number) => {
    const url = runId != null ? `/api/commands/${id}/stop?runId=${runId}` : `/api/commands/${id}/stop`;
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to stop");
      return;
    }
    await fetchCommands();
  };

  const handleRestart = async (id: number) => {
    const res = await fetch(`/api/commands/${id}/restart`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to restart");
      return;
    }
    await fetchCommands();
  };

  const handleCreate = async (data: CommandFormData) => {
    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to create");
      return;
    }
    setShowForm(false);
    await fetchCommands();
  };

  const handleUpdate = async (id: number, data: CommandFormData) => {
    const res = await fetch(`/api/commands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to update");
      return;
    }
    setEditingId(null);
    await fetchCommands();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this command?")) return;
    const res = await fetch(`/api/commands/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to delete");
      return;
    }
    await fetchCommands();
  };

  if (loading) return <p className="text-zinc-500">Loading commands…</p>;

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
