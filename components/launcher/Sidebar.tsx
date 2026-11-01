"use client";

import { Activity, Layers, Plus, SquareTerminal, Terminal } from "lucide-react";
import type { View } from "./useNav";

interface SidebarProps {
  view: View;
  counts: Record<View, number>;
  connected: boolean;
  onView: (view: View) => void;
  onNewCommand: () => void;
  onNewGroup: () => void;
}

const items: { view: View; label: string; icon: typeof Activity; key: string }[] = [
  { view: "running", label: "Running", icon: Activity, key: "1" },
  { view: "commands", label: "Commands", icon: Terminal, key: "2" },
  { view: "groups", label: "Groups", icon: Layers, key: "3" },
];

function NavButton({
  active,
  label,
  count,
  icon: Icon,
  hotkey,
  highlight,
  onClick,
  compact,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: typeof Activity;
  hotkey: string;
  highlight?: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={`${label} (${hotkey})`}
      className={`group flex items-center gap-2.5 rounded-md text-sm transition-colors ${
        compact ? "px-3 py-1.5 shrink-0" : "w-full px-2.5 py-1.5"
      } ${
        active
          ? "bg-zinc-200/70 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
          : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
      }`}
    >
      <Icon size={16} className={highlight ? "text-emerald-500" : ""} />
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`min-w-5 rounded px-1.5 text-center text-xs tabular-nums ${
          highlight
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "text-zinc-500 dark:text-zinc-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

export function Sidebar({ view, counts, connected, onView, onNewCommand, onNewGroup }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2 px-4 h-14 border-b border-zinc-200 dark:border-zinc-800">
          <SquareTerminal size={18} className="text-zinc-700 dark:text-zinc-300" />
          <span className="font-semibold tracking-tight">Launcher</span>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {items.map((it) => (
            <NavButton
              key={it.view}
              active={view === it.view}
              label={it.label}
              count={counts[it.view]}
              icon={it.icon}
              hotkey={it.key}
              highlight={it.view === "running" && counts.running > 0}
              onClick={() => onView(it.view)}
            />
          ))}
        </nav>
        <div className="space-y-1 border-t border-zinc-200 p-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={onNewCommand}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            <Plus size={16} /> New command
          </button>
          <button
            type="button"
            onClick={onNewGroup}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100"
          >
            <Plus size={16} /> New group
          </button>
          <div className="flex items-center gap-2 px-2.5 pt-2 text-xs text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {connected ? "Live" : "Reconnecting…"}
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto border-b border-zinc-200 px-2 py-2 dark:border-zinc-800">
        {items.map((it) => (
          <NavButton
            key={it.view}
            compact
            active={view === it.view}
            label={it.label}
            count={counts[it.view]}
            icon={it.icon}
            hotkey={it.key}
            highlight={it.view === "running" && counts.running > 0}
            onClick={() => onView(it.view)}
          />
        ))}
        <button
          type="button"
          onClick={view === "groups" ? onNewGroup : onNewCommand}
          title="New"
          className="ml-auto shrink-0 rounded-md p-1.5 text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Plus size={18} />
        </button>
      </div>
    </>
  );
}
