"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, RotateCcw, Loader2 } from "lucide-react";

export type RunAction = "run" | "stop" | "restart";

interface RunControlsProps {
  running: boolean;
  /** Current run id: a restart is confirmed when it changes. */
  runId?: number;
  /** Externally tracked in-flight action (e.g. group pending state). */
  pending?: RunAction | null;
  disabled?: boolean;
  /** Resolve to `false` when the action failed (buttons re-enable immediately). */
  onRun: () => Promise<boolean | void>;
  onStop: () => Promise<boolean | void>;
  onRestart: () => Promise<boolean | void>;
  size?: "sm" | "md";
}

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400";

/** Run / Stop / Restart with busy state that lasts until the list confirms the new state. */
export function RunControls({
  running,
  runId,
  pending: externalPending,
  disabled,
  onRun,
  onStop,
  onRestart,
  size = "sm",
}: RunControlsProps) {
  const [inFlight, setInFlight] = useState<RunAction | null>(null);
  const [awaiting, setAwaiting] = useState<{ action: RunAction; prevRunId?: number } | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const awaitingDone =
    awaiting != null &&
    ((awaiting.action === "run" && running) ||
      (awaiting.action === "stop" && !running) ||
      (awaiting.action === "restart" && running && runId !== awaiting.prevRunId));
  if (awaitingDone) setAwaiting(null); // adjusting state during render once confirmed

  const busy = externalPending ?? inFlight ?? (awaiting && !awaitingDone ? awaiting.action : null);

  useEffect(
    () => () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    },
    []
  );

  const perform = async (action: RunAction, fn: () => Promise<boolean | void>) => {
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

  const icon = size === "sm" ? 14 : 16;
  const pad = size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-3 text-sm";
  const spin = <Loader2 size={icon} className="animate-spin" />;
  const isDisabled = disabled || !!busy;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {running ? (
        <>
          <button
            type="button"
            title="Stop"
            disabled={isDisabled}
            onClick={() => perform("stop", onStop)}
            className={`${base} ${pad} bg-red-500/10 text-red-700 hover:bg-red-500/20 dark:text-red-300`}
          >
            {busy === "stop" ? spin : <Square size={icon} />}
            {size === "md" && (busy === "stop" ? "Stopping…" : "Stop")}
          </button>
          <button
            type="button"
            title="Restart"
            disabled={isDisabled}
            onClick={() => perform("restart", onRestart)}
            className={`${base} ${pad} bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300`}
          >
            {busy === "restart" ? spin : <RotateCcw size={icon} />}
            {size === "md" && "Restart"}
          </button>
        </>
      ) : (
        <button
          type="button"
          title="Run"
          disabled={isDisabled}
          onClick={() => perform("run", onRun)}
          className={`${base} ${pad} bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300`}
        >
          {busy === "run" ? spin : <Play size={icon} />}
          {size === "md" && "Run"}
        </button>
      )}
    </div>
  );
}
