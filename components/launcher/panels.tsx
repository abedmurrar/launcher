"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Columns3, Folder, GitBranch, Hash, Pencil, Trash2, X } from "lucide-react";
import type { CommandListItem, GroupListItem } from "@/context/ws";
import { CommandForm } from "@/components/CommandForm";
import { GroupForm } from "@/components/GroupForm";
import { GroupLogViewer } from "@/components/GroupLogViewer";
import { RunControls } from "@/components/RunControls";
import { apiClient } from "@/lib/api";
import { parseDbDate, relativeTime } from "@/lib/format-time";
import type { useCommandActions } from "@/hooks/useCommandActions";
import type { useGroupActions } from "@/hooks/useGroupActions";
import { StatusDot, StatusText, runStateOf } from "./StatusDot";
import { NoRuns, RunLogs } from "./RunLogs";

type CommandActions = ReturnType<typeof useCommandActions>;
type GroupActions = ReturnType<typeof useGroupActions>;

const iconBtn =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";

function PanelHeader({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onClose} className={iconBtn} title="Close (Esc)" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

function Meta({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0 text-zinc-400" title={label}>
        {icon}
      </span>
      <div className="min-w-0 flex-1 break-all text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

export function CommandDetail({
  command: c,
  actions,
  onClose,
  onDeleted,
}: {
  command: CommandListItem;
  actions: CommandActions;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const state = runStateOf(c.running, c.last_run_status);
  const lastRun = parseDbDate(c.last_run_at);
  const logRunId = c.run_id ?? c.last_run_id;
  const envKeys = Object.keys(c.env ?? {});

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <StatusDot state={state} />
          <h2 className="truncate text-base font-semibold">{c.name}</h2>
        </div>
        <div className="mt-0.5 text-xs">
          <StatusText state={state} />
          {c.running && c.pid != null && <span className="text-zinc-500"> · pid {c.pid}</span>}
          {!c.running && lastRun && (
            <span className="text-zinc-500" title={lastRun.toLocaleString()}>
              {" "}· {relativeTime(lastRun)}
              {c.last_exit_code != null && ` · exit ${c.last_exit_code}`}
            </span>
          )}
        </div>
      </PanelHeader>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <RunControls
          size="md"
          running={c.running}
          runId={c.run_id}
          onRun={() => actions.run(c.id)}
          onStop={() => actions.stop(c.id, c.run_id)}
          onRestart={() => actions.restart(c.id)}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={iconBtn}
            disabled={c.running}
            title={c.running ? "Stop it first to edit" : "Edit"}
            onClick={() => setEditing((e) => !e)}
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            type="button"
            className={`${iconBtn} hover:!text-red-600`}
            disabled={c.running}
            title={c.running ? "Stop it first to delete" : "Delete"}
            onClick={async () => {
              if (await actions.remove(c.id)) onDeleted();
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="overflow-auto p-4">
          <CommandForm
            initial={{ name: c.name, command: c.command, cwd: c.cwd, env: c.env }}
            onSubmit={async (data) => {
              if (await actions.update(c.id, data)) setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-2 px-4 py-3">
            <Meta icon={<span className="font-mono text-xs">$</span>} label="Command">
              <code className="font-mono text-xs">{c.command}</code>
            </Meta>
            <Meta icon={<Folder size={14} />} label="Working directory">
              <span className="font-mono text-xs">{c.cwd || "(launcher directory)"}</span>
            </Meta>
            {c.git_branch && (
              <Meta icon={<GitBranch size={14} />} label="Git branch">
                <span className="text-xs">{c.git_branch}</span>
              </Meta>
            )}
            {envKeys.length > 0 && (
              <Meta icon={<Hash size={14} />} label="Environment">
                <span className="font-mono text-xs text-zinc-500">{envKeys.join("  ")}</span>
              </Meta>
            )}
          </div>
          {logRunId != null ? <RunLogs key={logRunId} runId={logRunId} /> : <NoRuns />}
        </>
      )}
    </div>
  );
}

interface GroupRun {
  runId: number;
  commandName: string;
}

function GroupRunLogs({ groupRunId }: { groupRunId: number }) {
  const [runs, setRuns] = useState<GroupRun[] | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [sideBySide, setSideBySide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiClient.get<{ runs: GroupRun[] }>(`/api/group-runs/${groupRunId}/runs`).then((res) => {
      if (cancelled) return;
      const list = res.status < 300 ? (res.data?.runs ?? []) : [];
      setRuns(list);
      setActive((prev) => (prev != null && list.some((r) => r.runId === prev) ? prev : (list[0]?.runId ?? null)));
    });
    return () => {
      cancelled = true;
    };
  }, [groupRunId]);

  if (runs == null) return <div className="px-4 py-3 text-sm text-zinc-500">Loading…</div>;
  if (runs.length === 0) return <NoRuns />;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto px-4 pt-2">
        {runs.map((r) => (
          <button
            key={r.runId}
            type="button"
            onClick={() => setActive(r.runId)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-xs ${
              active === r.runId
                ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {r.commandName}
          </button>
        ))}
        {runs.length > 1 && (
          <button type="button" onClick={() => setSideBySide(true)} className={`${iconBtn} ml-auto h-7 text-xs`}>
            <Columns3 size={13} /> Side by side
          </button>
        )}
      </div>
      {active != null && <RunLogs key={active} runId={active} />}
      {sideBySide && <GroupLogViewer groupRunId={groupRunId} onClose={() => setSideBySide(false)} />}
    </div>
  );
}

export function GroupDetail({
  group: g,
  commands,
  actions,
  onClose,
  onDeleted,
  onSelectCommand,
}: {
  group: GroupListItem;
  commands: CommandListItem[];
  actions: GroupActions;
  onClose: () => void;
  onDeleted: () => void;
  onSelectCommand: (id: number) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [editingMembers, setEditingMembers] = useState(false);
  const state = runStateOf(g.running, g.last_run?.status);
  const byId = useMemo(() => new Map(commands.map((c) => [c.id, c])), [commands]);
  const members = g.command_ids.map((id) => byId.get(id)).filter(Boolean) as CommandListItem[];
  const groupRunId = g.running_group_run_id ?? g.last_run?.id;
  const lastRun = parseDbDate(g.last_run?.started_at);

  const toggleMember = (id: number) => {
    const next = g.command_ids.includes(id) ? g.command_ids.filter((x) => x !== id) : [...g.command_ids, id];
    void actions.setMembers(g.id, next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader onClose={onClose}>
        {renaming ? (
          <GroupForm
            initialName={g.name}
            onSubmit={async (name) => {
              if (await actions.rename(g.id, name)) setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StatusDot state={state} />
              <h2 className="truncate text-base font-semibold">{g.name}</h2>
            </div>
            <div className="mt-0.5 text-xs">
              <StatusText state={state} />
              {!g.running && lastRun && (
                <span className="text-zinc-500" title={lastRun.toLocaleString()}>
                  {" "}· {relativeTime(lastRun)}
                </span>
              )}
            </div>
          </>
        )}
      </PanelHeader>

      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <RunControls
          size="md"
          running={g.running}
          runId={g.running_group_run_id}
          pending={actions.pending[g.id] ?? null}
          disabled={g.command_ids.length === 0}
          onRun={() => actions.run(g.id)}
          onStop={() => actions.stop(g.id)}
          onRestart={() => actions.restart(g.id)}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className={iconBtn}
            disabled={g.running}
            title={g.running ? "Stop it first to rename" : "Rename"}
            onClick={() => setRenaming(true)}
          >
            <Pencil size={14} /> Rename
          </button>
          <button
            type="button"
            className={`${iconBtn} hover:!text-red-600`}
            disabled={g.running}
            title={g.running ? "Stop it first to delete" : "Delete"}
            onClick={async () => {
              if (await actions.remove(g.id)) onDeleted();
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Commands
          <button
            type="button"
            disabled={g.running}
            onClick={() => setEditingMembers((e) => !e)}
            className="ml-auto rounded px-1.5 py-0.5 text-xs font-normal normal-case tracking-normal hover:bg-zinc-200/60 disabled:opacity-40 dark:hover:bg-zinc-800"
            title={g.running ? "Stop the group first to change members" : undefined}
          >
            {editingMembers ? "Done" : "Edit"}
          </button>
        </div>
        {editingMembers ? (
          <ul className="max-h-56 space-y-0.5 overflow-auto">
            {commands.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
                  <input
                    type="checkbox"
                    checked={g.command_ids.includes(c.id)}
                    onChange={() => toggleMember(c.id)}
                    className="accent-emerald-600"
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : members.length === 0 ? (
          <p className="text-sm text-zinc-500">No commands yet. Click Edit to add some.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {members.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelectCommand(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <StatusDot state={runStateOf(c.running, c.last_run_status)} />
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {groupRunId != null ? <GroupRunLogs key={groupRunId} groupRunId={groupRunId} /> : <NoRuns />}
    </div>
  );
}

export function NewCommandPanel({
  actions,
  onClose,
  onCreated,
}: {
  actions: CommandActions;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader onClose={onClose}>
        <h2 className="text-base font-semibold">New command</h2>
      </PanelHeader>
      <div className="overflow-auto p-4">
        <CommandForm
          onSubmit={async (data) => {
            const id = await actions.create(data);
            if (id != null) onCreated(id);
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

export function NewGroupPanel({
  actions,
  onClose,
  onCreated,
}: {
  actions: GroupActions;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader onClose={onClose}>
        <h2 className="text-base font-semibold">New group</h2>
      </PanelHeader>
      <div className="p-4">
        <GroupForm
          onSubmit={async (name) => {
            const id = await actions.create(name);
            if (id != null) onCreated(id);
          }}
          onCancel={onClose}
        />
        <p className="mt-3 text-xs text-zinc-500">You can pick its commands right after creating it.</p>
      </div>
    </div>
  );
}
