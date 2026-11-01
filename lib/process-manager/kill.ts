import {
  countRunningRunsByGroupRunId,
  updateGroupRunStatus,
  updateRunsKilledByGroupRunId,
} from "@/lib/db/queries";
import { config } from "@/lib/config";
import { groupRunIdToPids } from "./state";
import { isProcessGroupAlive, sleep, waitFor } from "./process-utils";

/**
 * Send a signal to the process group led by `pid` (POSIX) or the pid itself (Windows).
 * Never signals pid <= 0: process.kill(-0) would hit the launcher's own process group.
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
  /** True when SIGKILL was needed because the group outlived the grace period. */
  forced: boolean;
}

/** SIGTERM the group, then SIGKILL it if anything is still alive after `graceMs`. */
export async function terminateProcessGroup(
  pid: number,
  graceMs: number = config.stopGraceMs
): Promise<TerminateResult> {
  if (!killProcessGroup(pid, "SIGTERM")) return { forced: false };
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    await sleep(100);
    if (!isProcessGroupAlive(pid)) return { forced: false };
  }
  killProcessGroup(pid, "SIGKILL");
  return { forced: true };
}

/** How long to wait for exit handlers to finalize runs after their processes are gone. */
const FINALIZE_WAIT_MS = 3_000;

/**
 * Stop every process in a group run. The group's status is set first so member exit
 * handlers don't re-trigger a group kill or mark it successful.
 */
export async function killGroupRun(
  groupRunId: number,
  status: "failed" | "killed" = "killed"
): Promise<TerminateResult> {
  await updateGroupRunStatus(groupRunId, status);

  const pids = [...(groupRunIdToPids.get(groupRunId) ?? [])];
  const results = await Promise.all(pids.map((p) => terminateProcessGroup(p)));

  await waitFor(async () => (await countRunningRunsByGroupRunId(groupRunId)) === 0, FINALIZE_WAIT_MS);
  // Anything still "running" in the DB has no live process (or never had one).
  await updateRunsKilledByGroupRunId(groupRunId);

  return { forced: results.some((r) => r.forced) };
}
