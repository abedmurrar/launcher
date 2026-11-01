import { getRunDetailsById, getRunningRunIdByCommandId, isRunStillRunning } from "@/lib/db/queries";
import { config } from "@/lib/config";
import { isOwnedRun, markStopReason, runIdToPid } from "./state";
import { terminateRun } from "./kill";
import { finalizeRun } from "./finalize-run";
import { isSameProcess } from "./identity";
import { waitFor } from "./process-utils";
import type { EndReason } from "./types";

export interface StopResult {
  /** False only when the run does not exist. */
  stopped: boolean;
  /** True when something ignored SIGTERM and was SIGKILLed. */
  forced: boolean;
}

/** How long to wait for the exit handler / supervisor to finalize after the processes are gone. */
const FINALIZE_WAIT_MS = 3_000;

/**
 * Stop a run: SIGTERM everything that belongs to it, escalate to SIGKILL after the grace period,
 * and make sure the run is finalized (with `reason`) even if no exit event arrives.
 */
export async function stopRun(
  runId: number,
  graceMs: number = config.stopGraceMs,
  reason: EndReason = "stopped"
): Promise<StopResult> {
  const details = await getRunDetailsById(runId);
  if (!details) return { stopped: false, forced: false };
  if (details.status !== "running") return { stopped: true, forced: false };

  markStopReason(runId, reason);
  const owned = isOwnedRun(runId);
  const leader = runIdToPid.get(runId) ?? details.pid ?? null;
  // Only trust the pid if it is provably still the run's process.
  const verifiedLeader =
    leader &&
    (owned ||
      isSameProcess({
        pid: leader,
        pidStartTime: details.pid_start_time,
        bootId: details.boot_id,
        startedAt: details.started_at,
      }))
      ? leader
      : null;

  const { forced } = await terminateRun(runId, verifiedLeader, graceMs);

  // Owned/adopted runs are finalized by their exit handler or the supervisor; give it a moment.
  const tracked = runIdToPid.has(runId);
  const finalized = await waitFor(async () => !(await isRunStillRunning(runId)), tracked ? FINALIZE_WAIT_MS : 0);
  if (!finalized) {
    await finalizeRun(runId, leader ?? 0, details.command_id, details.group_run_id ?? null, null, {
      clearMaps: true,
      reason,
    });
  }
  return { stopped: true, forced };
}

export async function stopByCommandId(commandId: number, reason: EndReason = "stopped"): Promise<StopResult> {
  const runId = await getRunningRunIdByCommandId(commandId);
  if (runId === null) return { stopped: false, forced: false };
  return stopRun(runId, undefined, reason);
}

/** Stop the command's running run (if any) and resolve once it is finalized. */
export async function stopByCommandIdAndWait(commandId: number): Promise<StopResult> {
  return stopByCommandId(commandId);
}
