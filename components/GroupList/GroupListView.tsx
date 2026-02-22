"use client";

import { Play, Square, RotateCcw, Pencil, Trash2, History } from "lucide-react";
import { GroupForm } from "@/components/GroupForm";
import { GroupLogViewer } from "@/components/GroupLogViewer";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import type { UseGroupListReturn } from "./useGroupList";

const iconSize = 16;

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
                <>
                  <GroupForm
                    initialName={g.name}
                    onSubmit={(name) => handleUpdateName(g.id, name)}
                    onCancel={() => setEditing(null)}
                  />
                  <div className="mt-4">
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
                      disabled={g.running}
                      className="w-full min-h-[80px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      title={g.running ? "Stop the group first to change members" : undefined}
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
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.name}</span>
                      {g.running && (
                        <span className="ml-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                          running
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(g.id)}
                        disabled={g.running}
                        className="p-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={g.running ? "Stop the group first to edit" : "Edit"}
                      >
                        <Pencil size={iconSize} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(g.id)}
                        disabled={g.running}
                        className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={g.running ? "Stop the group first to delete" : "Delete"}
                      >
                        <Trash2 size={iconSize} />
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
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {g.running ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStop(g.id)}
                          disabled={!!loading}
                          title="Stop"
                          className="p-1.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
                        >
                          {loading?.groupId === g.id && loading?.action === "stop" ? "…" : <Square size={iconSize} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestart(g.id)}
                          disabled={!!loading || g.command_ids.length === 0}
                          title="Restart"
                          className="p-1.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50"
                        >
                          {loading?.groupId === g.id && loading?.action === "restart" ? "…" : <RotateCcw size={iconSize} />}
                        </button>
                        {g.running_group_run_id != null && (
                          <button
                            type="button"
                            onClick={() => openGroupLogs(g.running_group_run_id!)}
                            title="View logs"
                            className="p-1.5 rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                          >
                            <History size={iconSize} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleRun(g.id)}
                          disabled={!!loading || g.command_ids.length === 0}
                          title="Run"
                          className="p-1.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50"
                        >
                          {loading?.groupId === g.id && loading?.action === "run" ? "…" : <Play size={iconSize} />}
                        </button>
                        {g.last_run != null && (
                          <button
                            type="button"
                            onClick={() => openGroupLogs(g.last_run!.id)}
                            title="View logs"
                            className="p-1.5 rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                          >
                            <History size={iconSize} />
                          </button>
                        )}
                      </>
                    )}
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

        {logGroupRunId != null && (
          <GroupLogViewer groupRunId={logGroupRunId} onClose={closeGroupLogs} />
        )}
      </div>
    </ConnectionStatus>
  );
}
