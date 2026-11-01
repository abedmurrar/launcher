export type RunState = "running" | "success" | "failed" | "killed" | "idle" | "stale";

const dotClass: Record<RunState, string> = {
  running: "bg-emerald-500",
  success: "bg-zinc-400 dark:bg-zinc-500",
  failed: "bg-red-500",
  killed: "bg-amber-500",
  idle: "border border-zinc-400 dark:border-zinc-600",
  stale: "border-2 border-dashed border-zinc-400 dark:border-zinc-500",
};

export function runStateOf(running: boolean, lastStatus?: string | null, stale = false): RunState {
  if (running) return stale ? "stale" : "running";
  if (lastStatus === "success" || lastStatus === "failed" || lastStatus === "killed") return lastStatus;
  return "idle";
}

/** Small colored dot; pulses while running. */
export function StatusDot({ state, className = "" }: { state: RunState; className?: string }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`} aria-hidden>
      {state === "running" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dotClass[state]}`} />
    </span>
  );
}

const labelClass: Record<RunState, string> = {
  running: "text-emerald-600 dark:text-emerald-400",
  success: "text-zinc-500",
  failed: "text-red-600 dark:text-red-400",
  killed: "text-amber-600 dark:text-amber-400",
  idle: "text-zinc-400",
  stale: "text-zinc-500",
};

export function statusLabel(state: RunState): string {
  return {
    running: "running",
    success: "exited",
    failed: "failed",
    killed: "stopped",
    idle: "never run",
    stale: "last known: running",
  }[state];
}

export function StatusText({ state, className = "" }: { state: RunState; className?: string }) {
  return <span className={`${labelClass[state]} ${className}`}>{statusLabel(state)}</span>;
}
