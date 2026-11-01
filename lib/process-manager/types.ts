import type { ChildProcess } from "child_process";

export interface RunRecord {
  childProcess?: ChildProcess;
  commandId: number;
  runId: number;
  groupRunId: number | null;
}


/**
 * Why a run ended.
 * - exited / failed: the process exited by itself with code 0 / non-zero
 * - stopped: stopped by the user (Stop, Stop all, group stop/restart)
 * - group_failed: stopped because another member of its group failed
 * - signal:<NAME>: killed by a signal from outside the launcher
 * - ended: an adopted process (started before a launcher restart) ended; exit code unknown
 * - launcher_down: it ended while the launcher wasn't running; exit code unknown
 * - reboot: the machine restarted while it was running
 * - spawn_failed: it could not be started
 */
export type EndReason =
  | "exited"
  | "failed"
  | "stopped"
  | "group_failed"
  | `signal:${string}`
  | "ended"
  | "launcher_down"
  | "reboot"
  | "spawn_failed";
