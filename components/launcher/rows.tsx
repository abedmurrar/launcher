"use client";

import { GitBranch, Layers } from "lucide-react";
import type { CommandListItem, GroupListItem } from "@/context/ws";
import { RunControls } from "@/components/RunControls";
import { parseDbDate, relativeTime } from "@/lib/format-time";
import { describeEnd } from "@/lib/end-reason";
import { StatusDot, runStateOf } from "./StatusDot";
import type { GroupRunAction } from "@/hooks/useGroupActions";

const rowBase =
  "group grid w-full cursor-pointer items-center gap-3 border-b border-zinc-100 px-4 py-2.5 text-left outline-none transition-colors last:border-b-0 dark:border-zinc-800/70";
const rowState = (selected: boolean) =>
  selected
    ? "bg-zinc-100 dark:bg-zinc-800/70"
    : "hover:bg-zinc-50 focus-visible:bg-zinc-50 dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900";

function LastRun({
  at,
  exitCode,
  status,
  reason,
  running,
}: {
  at: string | null;
  exitCode?: number | null;
  status?: string | null;
  reason?: string | null;
  running: boolean;
}) {
  if (running) return <span className="text-emerald-600 dark:text-emerald-400">running</span>;
  const date = parseDbDate(at);
  if (!date) return <span className="text-zinc-400">never run</span>;
  const suffix = describeEnd(reason, exitCode, status);
  return (
    <span title={date.toLocaleString()}>
      {relativeTime(date)}
      {suffix && <span className="text-zinc-400"> · {suffix}</span>}
    </span>
  );
}

export function CommandRow({
  command: c,
  selected,
  onSelect,
  onRun,
  onStop,
  onRestart,
}: {
  command: CommandListItem;
  selected: boolean;
  onSelect: () => void;
  onRun: () => Promise<boolean>;
  onStop: () => Promise<boolean>;
  onRestart: () => Promise<boolean>;
}) {
  const state = runStateOf(c.running, c.last_run_status);
  return (
    <div
      role="button"
      tabIndex={0}
      data-row-key={`c${c.id}`}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={`${rowBase} ${rowState(selected)} grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_8rem_10rem_auto]`}
    >
      <StatusDot state={state} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{c.name}</div>
        <div className="truncate font-mono text-xs text-zinc-500" title={c.command}>
          {c.command}
        </div>
      </div>
      <div className="hidden sm:flex min-w-0 items-center gap-1 text-xs text-zinc-500">
        {c.git_branch ? (
          <>
            <GitBranch size={12} className="shrink-0" />
            <span className="truncate" title={c.git_branch}>
              {c.git_branch}
            </span>
          </>
        ) : null}
      </div>
      <div className="hidden sm:block text-xs text-zinc-500 tabular-nums">
        <LastRun
          at={c.last_run_at}
          exitCode={c.last_exit_code}
          status={c.last_run_status}
          reason={c.last_end_reason}
          running={c.running}
        />
      </div>
      <RunControls running={c.running} runId={c.run_id} onRun={onRun} onStop={onStop} onRestart={onRestart} />
    </div>
  );
}

export function GroupRow({
  group: g,
  memberNames,
  selected,
  pending,
  onSelect,
  onRun,
  onStop,
  onRestart,
}: {
  group: GroupListItem;
  memberNames: string[];
  selected: boolean;
  pending: GroupRunAction | null;
  onSelect: () => void;
  onRun: () => Promise<void>;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
}) {
  const state = runStateOf(g.running, g.last_run?.status);
  return (
    <div
      role="button"
      tabIndex={0}
      data-row-key={`g${g.id}`}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      className={`${rowBase} ${rowState(selected)} grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[auto_minmax(0,1fr)_7rem_auto]`}
    >
      <StatusDot state={state} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          <Layers size={13} className="shrink-0 text-zinc-400" />
          {g.name}
        </div>
        <div className="truncate text-xs text-zinc-500">
          {memberNames.length === 0 ? "No commands" : memberNames.join(" · ")}
        </div>
      </div>
      <div className="hidden sm:block text-xs text-zinc-500 tabular-nums">
        <LastRun at={g.last_run?.started_at ?? null} status={g.last_run?.status} running={g.running} />
      </div>
      <RunControls
        running={g.running}
        runId={g.running_group_run_id}
        pending={pending}
        disabled={g.command_ids.length === 0}
        onRun={onRun}
        onStop={onStop}
        onRestart={onRestart}
      />
    </div>
  );
}

export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/90">
      {children}
    </div>
  );
}
