/** Runtime tunables shared by the server and route handlers (all overridable via env). */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const config = {
  /** Grace period between SIGTERM and SIGKILL when stopping a run. */
  stopGraceMs: envInt("LAUNCHER_STOP_GRACE_MS", 5_000),
  /** Log write batching: flush interval and max buffered bytes per run. */
  logFlushIntervalMs: envInt("LAUNCHER_LOG_FLUSH_MS", 100),
  logFlushMaxBytes: envInt("LAUNCHER_LOG_FLUSH_BYTES", 64 * 1024),
  /** Max bytes of log history sent when a client subscribes to a run. */
  logHistoryMaxBytes: envInt("LAUNCHER_LOG_HISTORY_BYTES", 2 * 1024 * 1024),
  /** Retention: keep logs for the last N runs per command, and nothing older than X days (0 = no age limit). */
  logRetainRunsPerCommand: envInt("LAUNCHER_LOG_RETAIN_RUNS", 20),
  logRetainDays: envInt("LAUNCHER_LOG_RETAIN_DAYS", 30),
  logRetentionIntervalMs: envInt("LAUNCHER_LOG_RETENTION_INTERVAL_MS", 60 * 60 * 1000),
  /** Debounce for rebuilding + broadcasting command/group lists. */
  listBroadcastDebounceMs: envInt("LAUNCHER_LIST_DEBOUNCE_MS", 150),
  /** Git branch cache TTL. */
  gitBranchTtlMs: envInt("LAUNCHER_GIT_BRANCH_TTL_MS", 10_000),
} as const;
