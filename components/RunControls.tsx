"use client";

import { useState } from "react";
import type { CommandActionType } from "@/lib/ws-action-handlers/types";
import { CommandAction } from "@/lib/ws-action-handlers/types";

type RunControlsProps = {
  commandId: number;
  runId?: number;
  lastRunId?: number;
  pid?: number;
  running: boolean;
  onRun: () => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onRestart: () => Promise<unknown>;
  onLogs: (runId: number) => void;
};

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
  const [loading, setLoading] = useState<CommandActionType | null>(null);

  const handleRun = async () => {
    setLoading(CommandAction.Run);
    try {
      await onRun();
    } finally {
      setLoading(null);
    }
  };
  const handleStop = async () => {
    setLoading(CommandAction.Stop);
    try {
      await onStop();
    } finally {
      setLoading(null);
    }
  };
  const handleRestart = async () => {
    setLoading(CommandAction.Restart);
    try {
      await onRestart();
    } finally {
      setLoading(null);
    }
  };

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
            className="px-2 py-1 text-sm rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Stop ? "…" : "Stop"}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            disabled={!!loading}
            className="px-2 py-1 text-sm rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Restart ? "…" : "Restart"}
          </button>
          {runId != null && (
            <button
              type="button"
              onClick={() => onLogs(runId)}
              className="px-2 py-1 text-sm rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              Logs
            </button>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleRun}
            disabled={!!loading}
            className="px-2 py-1 text-sm rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 disabled:opacity-50"
          >
            {loading === CommandAction.Run ? "…" : "Run"}
          </button>
          {(runId ?? lastRunId) != null && (
            <button
              type="button"
              onClick={() => onLogs((runId ?? lastRunId)!)}
              className="px-2 py-1 text-sm rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600"
            >
              View logs
            </button>
          )}
        </>
      )}
    </div>
  );
}
