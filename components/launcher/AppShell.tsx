"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useWs } from "@/context/ws";
import type { CommandListItem, GroupListItem } from "@/context/ws";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import { StopAllButton } from "@/components/StopAllButton";
import { useCommandActions } from "@/hooks/useCommandActions";
import { useGroupActions } from "@/hooks/useGroupActions";
import { Sidebar } from "./Sidebar";
import { CommandRow, GroupRow, SectionHeader } from "./rows";
import { CommandDetail, GroupDetail, NewCommandPanel, NewGroupPanel } from "./panels";
import { useNav, type Selection, type View } from "./useNav";
import { OfflineBanner, RestoreBanner } from "./Banners";
import { useToast } from "@/components/shared/Toast";
import { CommandAction } from "@/lib/ws-action-handlers/types";

const VIEW_TITLES: Record<View, string> = { running: "Running", commands: "Commands", groups: "Groups" };

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function AppShell() {
  const { commands, groups, ready, initialLoadDone, connectionError, restoreOffers, instanceId, lastSyncAt, sendAction } =
    useWs();
  const { toast } = useToast();

  // Offline detection: the socket is down and nothing has been synced (HTTP fallback) for 3s.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (ready) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [ready]);
  const offline = initialLoadDone && !ready && now - lastSyncAt > 3_000;

  // Tell the user when the launcher restarted underneath them (state was reconciled).
  const prevInstanceRef = useRef<string | null>(null);
  useEffect(() => {
    if (!instanceId) return;
    if (prevInstanceRef.current && prevInstanceRef.current !== instanceId) {
      toast("The launcher restarted. Showing its current state.", "info");
    }
    prevInstanceRef.current = instanceId;
  }, [instanceId, toast]);

  const restore = async () => {
    const result = await sendAction(CommandAction.Restore, {});
    if (!result.success) {
      toast(result.error ?? "Restore failed", "error");
      return;
    }
    const data = result.data as { restored?: number; failed?: string[] } | undefined;
    if (data?.failed?.length) toast(`Some couldn't be restored: ${data.failed.join("; ")}`, "error");
    else toast(`Restored ${data?.restored ?? 0}`, "success");
  };
  const dismissRestore = async () => {
    const result = await sendAction(CommandAction.DismissRestore, {});
    if (!result.success) toast(result.error ?? "Failed to dismiss", "error");
  };
  const { view, selection, navigate } = useNav();
  const commandActions = useCommandActions();
  const groupActions = useGroupActions();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commandName = useMemo(() => new Map(commands.map((c) => [c.id, c.name])), [commands]);
  const memberNames = useCallback(
    (g: GroupListItem) => g.command_ids.map((id) => commandName.get(id) ?? `#${id}`),
    [commandName]
  );

  // A–Z so rows don't jump around when something starts or stops.
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
  const sortedCommands = useMemo(() => [...commands].sort(byName), [commands]);
  const sortedGroups = useMemo(() => [...groups].sort(byName), [groups]);
  const runningCommands = sortedCommands.filter((c) => c.running);
  const runningGroups = sortedGroups.filter((g) => g.running);

  const commandMatches = (c: CommandListItem) => matches(query, c.name, c.command, c.cwd, c.git_branch);
  const groupMatches = (g: GroupListItem) => matches(query, g.name, ...memberNames(g));

  const visibleCommands =
    view === "groups" ? [] : (view === "running" ? runningCommands : sortedCommands).filter(commandMatches);
  const visibleGroups =
    view === "commands" ? [] : (view === "running" ? runningGroups : sortedGroups).filter(groupMatches);

  /** Row order on screen, for keyboard navigation. */
  type RowKey = { kind: "command" | "group"; id: number };
  const rowKeys: RowKey[] = [
    ...(view === "running" ? visibleGroups : []).map((g) => ({ kind: "group" as const, id: g.id })),
    ...visibleCommands.map((c) => ({ kind: "command" as const, id: c.id })),
    ...(view === "groups" ? visibleGroups : []).map((g) => ({ kind: "group" as const, id: g.id })),
  ];

  const select = useCallback((sel: Selection) => navigate({ view, selection: sel }), [navigate, view]);
  const closePanel = useCallback(() => navigate({ view, selection: null }), [navigate, view]);
  const switchView = useCallback(
    (v: View) => {
      setQuery("");
      navigate({ view: v, selection: null });
    },
    [navigate]
  );

  const isSelected = (kind: "command" | "group", id: number) =>
    selection != null && selection.kind === kind && "id" in selection && selection.id === id;

  // Keyboard: "/" search, Esc close/clear, 1-3 switch views, j/k or arrows move through rows.
  const rowKeysRef = useRef(rowKeys);
  useEffect(() => {
    rowKeysRef.current = rowKeys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=alertdialog]")) return; // confirm dialog open
      const typing = isTyping(e.target);
      if (e.key === "Escape") {
        if (typing && e.target === searchRef.current) {
          if (query) setQuery("");
          else searchRef.current?.blur();
          return;
        }
        if (!typing && selection) closePanel();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "1" || e.key === "2" || e.key === "3") {
        switchView((["running", "commands", "groups"] as View[])[Number(e.key) - 1]);
      } else if (["j", "k", "ArrowDown", "ArrowUp"].includes(e.key)) {
        const keys = rowKeysRef.current;
        if (keys.length === 0) return;
        e.preventDefault();
        const idx = keys.findIndex(
          (k) => selection != null && "id" in selection && k.kind === selection.kind && k.id === selection.id
        );
        const down = e.key === "j" || e.key === "ArrowDown";
        const next = keys[idx === -1 ? (down ? 0 : keys.length - 1) : Math.min(keys.length - 1, Math.max(0, idx + (down ? 1 : -1)))];
        if (next) {
          select(next as Selection);
          const row = listRef.current?.querySelector(`[data-row-key="${next.kind === "command" ? "c" : "g"}${next.id}"]`);
          row?.scrollIntoView({ block: "nearest" });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, selection, closePanel, switchView, select]);

  const selectedCommand =
    selection?.kind === "command" ? commands.find((c) => c.id === selection.id) : undefined;
  const selectedGroup = selection?.kind === "group" ? groups.find((g) => g.id === selection.id) : undefined;

  let panel: React.ReactNode = null;
  if (selectedCommand) {
    panel = (
      <CommandDetail
        key={`c${selectedCommand.id}`}
        command={selectedCommand}
        actions={commandActions}
        stale={offline}
        onClose={closePanel}
        onDeleted={closePanel}
      />
    );
  } else if (selectedGroup) {
    panel = (
      <GroupDetail
        key={`g${selectedGroup.id}`}
        group={selectedGroup}
        commands={commands}
        actions={groupActions}
        stale={offline}
        onClose={closePanel}
        onDeleted={closePanel}
        onSelectCommand={(id) => select({ kind: "command", id })}
      />
    );
  } else if (selection?.kind === "new-command") {
    panel = (
      <NewCommandPanel
        actions={commandActions}
        onClose={closePanel}
        onCreated={(id) => navigate({ view: "commands", selection: { kind: "command", id } }, { replace: true })}
      />
    );
  } else if (selection?.kind === "new-group") {
    panel = (
      <NewGroupPanel
        actions={groupActions}
        onClose={closePanel}
        onCreated={(id) => navigate({ view: "groups", selection: { kind: "group", id } }, { replace: true })}
      />
    );
  }

  const commandRow = (c: CommandListItem) => (
    <CommandRow
      key={`c${c.id}`}
      command={c}
      stale={offline}
      selected={isSelected("command", c.id)}
      onSelect={() => select({ kind: "command", id: c.id })}
      onRun={() => commandActions.run(c.id)}
      onStop={() => commandActions.stop(c.id, c.run_id)}
      onRestart={() => commandActions.restart(c.id)}
    />
  );
  const groupRow = (g: GroupListItem) => (
    <GroupRow
      key={`g${g.id}`}
      group={g}
      memberNames={memberNames(g)}
      stale={offline}
      selected={isSelected("group", g.id)}
      pending={groupActions.pending[g.id] ?? null}
      onSelect={() => select({ kind: "group", id: g.id })}
      onRun={() => groupActions.run(g.id)}
      onStop={() => groupActions.stop(g.id)}
      onRestart={() => groupActions.restart(g.id)}
    />
  );

  const totalVisible = visibleCommands.length + visibleGroups.length;
  const emptyText = query
    ? `Nothing matches “${query}”.`
    : view === "running"
      ? "Nothing is running."
      : view === "groups"
        ? "No groups yet. Groups start several commands together."
        : "No commands yet.";

  return (
    <div className="flex h-dvh flex-col md:flex-row bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        view={view}
        counts={{ running: runningCommands.length, commands: commands.length, groups: groups.length }}
        connected={ready}
        onView={switchView}
        onNewCommand={() => navigate({ view: view === "groups" ? "commands" : view, selection: { kind: "new-command" } })}
        onNewGroup={() => navigate({ view: "groups", selection: { kind: "new-group" } })}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <h1 className="hidden sm:block text-sm font-semibold">{VIEW_TITLES[view]}</h1>
          <div className="relative max-w-md flex-1">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${VIEW_TITLES[view].toLowerCase()}…`}
              aria-label="Search"
              className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-8 pr-14 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-600 dark:focus:bg-zinc-950"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-200 px-1.5 text-[10px] text-zinc-400 dark:border-zinc-700">
                /
              </kbd>
            )}
          </div>
          <div className="ml-auto">
            <StopAllButton />
          </div>
        </header>

        {offline && <OfflineBanner since={lastSyncAt} />}
        {!offline && <RestoreBanner offers={restoreOffers} onRestore={restore} onDismiss={dismissRestore} />}

        <div className="flex min-h-0 flex-1">
          <div ref={listRef} className="min-w-0 flex-1 overflow-y-auto">
            <ConnectionStatus initialLoadDone={initialLoadDone} connectionError={connectionError}>
              {totalVisible === 0 ? (
                <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-zinc-500">
                  <p>{emptyText}</p>
                  {!query && view !== "running" && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          view,
                          selection: view === "groups" ? { kind: "new-group" } : { kind: "new-command" },
                        })
                      }
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {view === "groups" ? "New group" : "New command"}
                    </button>
                  )}
                </div>
              ) : view === "running" ? (
                <>
                  {visibleGroups.length > 0 && (
                    <>
                      <SectionHeader>Groups</SectionHeader>
                      {visibleGroups.map(groupRow)}
                    </>
                  )}
                  {visibleCommands.length > 0 && (
                    <>
                      <SectionHeader>Commands</SectionHeader>
                      {visibleCommands.map(commandRow)}
                    </>
                  )}
                </>
              ) : view === "groups" ? (
                visibleGroups.map(groupRow)
              ) : (
                visibleCommands.map(commandRow)
              )}
            </ConnectionStatus>
            <p className="hidden lg:block px-4 py-3 text-[11px] text-zinc-400">
              <kbd>/</kbd> search · <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>Esc</kbd> close · <kbd>1</kbd>–<kbd>3</kbd> switch view
            </p>
          </div>

          {panel && (
            <aside className="fixed inset-0 z-40 flex flex-col bg-white dark:bg-zinc-950 lg:static lg:z-auto lg:w-[min(46rem,52%)] lg:shrink-0 lg:border-l lg:border-zinc-200 lg:dark:border-zinc-800">
              {panel}
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
