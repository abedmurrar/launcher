import {
  getRunningRunIdsByGroupRunId,
  updateGroupRunStatus,
  updateRunsKilledByGroupRunId,
} from "@/lib/db/queries";
import { config } from "@/lib/config";
import { isProcessGroupAlive, sleep } from "./process-utils";
import { findRunProcesses, isAlive, type ProcessRef } from "./identity";
import type { EndReason } from "./types";
import { stopRun } from "./stop";

/**
 * Send a signal to the process group led by `pid` (POSIX) or the pid itself (Windows).
 * Never signals pid <= 0: process.kill(-0) would hit the launcher's own process group.
 * Callers must have verified that `pid` is the run's process (see identity.ts).
 */
export function killProcessGroup(pid: number, signal: NodeJS.Signals | number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    if (process.platform !== "win32") {
      process.kill(-pid, signal);
    } else {
      process.kill(pid, signal);
    }
    return true;
  } catch {
    return false;
  }
}

export interface TerminateResult {
  /** True when SIGKILL was needed because something outlived the grace period. */
  forced: boolean;
}

function signalRefs(refs: ProcessRef[], signal: NodeJS.Signals): void {
  for (const ref of refs) {
    // Re-check identity right before signaling: never hit a reused pid.
    if (!isAlive(ref)) continue;
    try {
      process.kill(ref.pid, signal);
    } catch {
      // exited meanwhile
    }
  }
}

/**
 * Terminate everything belonging to a run: SIGTERM, then SIGKILL whatever is left after the grace
 * period.
 * - Linux: targets are the exact processes (pid + start time) carrying the run's marker or in the
 *   leader's process group, so descendants that changed process group are included and a reused
 *   pid is never signaled.
 * - Elsewhere: the leader's process group, only when `leaderPid` was verified alive by the caller.
 */
export async function terminateRun(
  runId: number,
  leaderPid: number | null,
  graceMs: number = config.stopGraceMs
): Promise<TerminateResult> {
  if (process.platform === "linux") {
    const targets = findRunProcesses(runId, leaderPid);
    if (targets.length === 0) return { forced: false };
    signalRefs(targets, "SIGTERM");
    const deadline = Date.now() + graceMs;
    let remaining = targets.filter(isAlive);
    while (remaining.length > 0 && Date.now() < deadline) {
      await sleep(100);
      remaining = remaining.filter(isAlive);
    }
    if (remaining.length === 0) return { forced: false };
    signalRefs(remaining, "SIGKILL");
    return { forced: true };
  }

  if (!leaderPid || !isProcessGroupAlive(leaderPid)) return { forced: false };
  killProcessGroup(leaderPid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    await sleep(100);
    if (!isProcessGroupAlive(leaderPid)) return { forced: false };
  }
  killProcessGroup(leaderPid, "SIGKILL");
  return { forced: true };
}

/**
 * Stop every running member of a group run. The group's status is set first so member exits
 * don't re-trigger a group kill or mark it successful.
 */
export async function killGroupRun(
  groupRunId: number,
  status: "failed" | "killed" = "killed"
): Promise<TerminateResult> {
  await updateGroupRunStatus(groupRunId, status);
  const reason: EndReason = status === "failed" ? "group_failed" : "stopped";
  const runIds = await getRunningRunIdsByGroupRunId(groupRunId);
  const results = await Promise.all(runIds.map((id) => stopRun(id, undefined, reason)));
  // Anything still "running" in the DB has no live process (or never had one).
  await updateRunsKilledByGroupRunId(groupRunId, reason);
  return { forced: results.some((r) => r.forced) };
}
