"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, History } from "lucide-react";
import type { CommandActionType } from "@/lib/ws-action-handlers/types";
import { CommandAction } from "@/lib/ws-action-handlers/types";

const iconSize = 16;

interface RunControlsProps {
  commandId: number;
  runId?: number;
  lastRunId?: number;
  pid?: number;
  running: boolean;
  /** Resolve to `false` when the action failed (buttons re-enable immediately). */
  onRun: () => Promise<boolean | void>;
  onStop: () => Promise<boolean | void>;
  onRestart: () => Promise<boolean | void>;
  onLogs: (runId: number) => void;
}

export function RunControls({
  commandId,
  runId,
  pid,
  running,
  onRun,
  onStop,
  onRestart,
  onLogs,
  lastRunId,
}: RunControlsProps) {
  /** Action whose request is in flight. */
  const [inFlight, setInFlight] = useState<CommandActionType | null>(null);
  /**
   * After a successful action, stay "busy" until the broadcast list reflects it
   * (or a short timeout), so the buttons don't flash back to the old state.
   */
  const [awaiting, setAwaiting] = useState<{ action: CommandActionType; prevRunId?: number } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const awaitingDone =
    awaiting != null &&
    ((awaiting.action === CommandAction.Run && running) ||
      (awaiting.action === CommandAction.Stop && !running) ||
      (awaiting.action === CommandAction.Restart && running && runId !== awaiting.prevRunId));
  if (awaitingDone) {
    // Adjusting state during render (React-supported) once the new state has arrived.
    setAwaiting(null);
  }
  const loading = inFlight ?? (awaiting && !awaitingDone ? awaiting.action : null);

  useEffect(() => () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
  }, []);

  const perform = async (action: CommandActionType, fn: () => Promise<boolean | void>) => {
    setInFlight(action);
    let ok = false;
    try {
      ok = (await fn()) !== false;
    } catch {
      ok = false;
    }
    setInFlight(null);
    if (!ok) return;
    setAwaiting({ action, prevRunId: runId });
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => setAwaiting(null), 3_000);
  };

  const handleRun = () => perform(CommandAction.Run, onRun);
  const handleStop = () => perform(CommandAction.Stop, onStop);
  const handleRestart = () => perform(CommandAction.Restart, onRestart);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {running ? (
        <>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-mono">
            PID {pid ?? "—"}
          </span>
          <button
            type="button"
            onClick={handleStop}
            disabled={!!loading}
            title="Stop"
            className="p-1.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Stop ? <span className="text-xs px-0.5">Stopping…</span> : <Square size={iconSize} />}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            disabled={!!loading}
            title="Restart"
            className="p-1.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Restart ? "…" : <RotateCcw size={iconSize} />}
          </button>
          {runId != null && (
            <button
              type="button"
              onClick={() => onLogs(runId)}
              title="Logs"
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
            onClick={handleRun}
            disabled={!!loading}
            title="Run"
            className="p-1.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Run ? "…" : <Play size={iconSize} />}
          </button>
          {(runId ?? lastRunId) != null && (
            <button
              type="button"
              onClick={() => onLogs((runId ?? lastRunId)!)}
              title="View logs"
              className="p-1.5 rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              <History size={iconSize} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
