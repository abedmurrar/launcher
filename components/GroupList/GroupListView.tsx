"use client";

import { GroupForm } from "@/components/GroupForm";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import type { UseGroupListReturn } from "./useGroupList";

/**
 * Presentational: renders group list UI from props only (no hooks, no sendAction).
 */
export function GroupListView(props: UseGroupListReturn) {
  const {
    groups,
    commandsForSelect,
    initialLoadDone,
    connectionError,
    showForm,
    editingId,
    openCreateForm,
    closeCreateForm,
    setEditing,
    handleCreate,
    handleUpdateName,
    handleSetCommands,
    handleRun,
    handleDelete,
  } = props;

  return (
    <ConnectionStatus initialLoadDone={initialLoadDone} connectionError={connectionError}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Groups</h2>
          <button
            type="button"
            onClick={openCreateForm}
            className="px-3 py-1.5 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            + Add group
          </button>
        </div>

        {showForm && !editingId && (
          <div className="p-4 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/50">
            <GroupForm onSubmit={handleCreate} onCancel={closeCreateForm} />
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
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.name}</span>
                    {g.running && (
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        running
                      </span>
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
                        onClick={() => setEditing(g.id)}
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
                    Commands:{" "}
                    {g.command_ids.length === 0
                      ? "none"
                      : g.command_ids
                          .map((cid) => commandsForSelect.find((c) => c.id === cid)?.name ?? `#${cid}`)
                          .join(", ")}
                  </p>
                  {g.last_run && (
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
                      Last run: {new Date(g.last_run.started_at).toLocaleString()} — {g.last_run.status}
                    </p>
                  )}
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
                      {commandsForSelect.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      Ctrl+click to select multiple; change selection to update group.
                    </p>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>

        {groups.length === 0 && !showForm && (
          <p className="text-zinc-500">
            No groups yet. Create one and add commands to run them together.
          </p>
        )}
      </div>
    </ConnectionStatus>
  );
}
