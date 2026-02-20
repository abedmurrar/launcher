"use client";

import { useState, useEffect, useCallback } from "react";
import { GroupForm } from "./GroupForm";

type CommandItem = { id: number; name: string };

type GroupItem = {
  id: number;
  name: string;
  created_at: string;
  command_ids: number[];
  last_run?: { id: number; started_at: string; finished_at: string | null; status: string };
  running: boolean;
  running_group_run_id?: number;
};

export function GroupList() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
  }, []);

  const fetchCommands = useCallback(async () => {
    const res = await fetch("/api/commands");
    if (res.ok) {
      const list = await res.json();
      setCommands(list.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchCommands()]);
      setLoading(false);
    })();
    const t = setInterval(fetchGroups, 3000);
    return () => clearInterval(t);
  }, [fetchGroups, fetchCommands]);

  const handleCreate = async (name: string) => {
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to create");
      return;
    }
    setShowForm(false);
    await fetchGroups();
  };

  const handleUpdateName = async (id: number, name: string) => {
    const res = await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to update");
      return;
    }
    setEditingId(null);
    await fetchGroups();
  };

  const handleSetCommands = async (id: number, commandIds: number[]) => {
    const res = await fetch(`/api/groups/${id}/commands`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandIds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to update commands");
      return;
    }
    await fetchGroups();
  };

  const handleRun = async (id: number) => {
    const res = await fetch(`/api/groups/${id}/run`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to run group");
      return;
    }
    await fetchGroups();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this group?")) return;
    const res = await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Failed to delete");
      return;
    }
    await fetchGroups();
  };

  if (loading) return <p className="text-zinc-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Groups</h2>
        <button
          type="button"
          onClick={() => { setShowForm(true); setEditingId(null); }}
          className="px-3 py-1.5 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300"
        >
          + Add group
        </button>
      </div>

      {showForm && !editingId && (
        <div className="p-4 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
          <GroupForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <ul className="space-y-3">
        {groups.map((g) => (
          <li
            key={g.id}
            className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50"
          >
            {editingId === g.id ? (
              <GroupForm
                initialName={g.name}
                onSubmit={(name) => handleUpdateName(g.id, name)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.name}</span>
                  {g.running && (
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">running</span>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRun(g.id)}
                      disabled={g.running || g.command_ids.length === 0}
                      className="px-2 py-1 text-sm rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50"
                    >
                      Run group
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(g.id)}
                      className="px-2 py-1 text-sm rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id)}
                      className="px-2 py-1 text-sm rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Commands: {g.command_ids.length === 0
                    ? "none"
                    : g.command_ids
                        .map((cid) => commands.find((c) => c.id === cid)?.name ?? `#${cid}`)
                        .join(", ")}
                </p>
                {g.last_run && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                    Last run: {new Date(g.last_run.started_at).toLocaleString()} — {g.last_run.status}
                  </p>
                )}
                {editingId !== g.id && (
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-500 mb-1">
                      Members
                    </label>
                    <select
                      multiple
                      value={g.command_ids.map(String)}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                        handleSetCommands(g.id, selected);
                      }}
                      className="w-full min-h-[80px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                    >
                      {commands.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      Ctrl+click to select multiple; change selection to update group.
                    </p>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {groups.length === 0 && !showForm && (
        <p className="text-zinc-500">No groups yet. Create one and add commands to run them together.</p>
      )}
    </div>
  );
}
