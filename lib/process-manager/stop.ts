import { getRunDetailsById, getRunningRunIdByCommandId, isRunStillRunning } from "@/lib/db/queries";
import { config } from "@/lib/config";
import { runIdToPid } from "./state";
import { terminateProcessGroup } from "./kill";
import { finalizeRun } from "./finalize-run";
import { isProcessGroupAlive, waitFor } from "./process-utils";

export interface StopResult {
  /** False only when the run does not exist. */
  stopped: boolean;
  /** True when the process ignored SIGTERM and was SIGKILLed. */
  forced: boolean;
}

/** How long to wait for the exit handler / adopted watcher to finalize after the process is gone. */
const FINALIZE_WAIT_MS = 3_000;

/**
 * Stop a run: SIGTERM its process group, escalate to SIGKILL after the grace period,
 * and make sure the run is finalized in the DB even if no exit event arrives.
 */
export async function stopRun(runId: number, graceMs: number = config.stopGraceMs): Promise<StopResult> {
  const details = await getRunDetailsById(runId);
  if (!details) return { stopped: false, forced: false };
  if (details.status !== "running") return { stopped: true, forced: false };

  const memoryPid = runIdToPid.get(runId);
  const pid = memoryPid ?? details.pid ?? 0;
  let forced = false;

  if (pid > 0 && isProcessGroupAlive(pid)) {
    ({ forced } = await terminateProcessGroup(pid, graceMs));
  }

  // Tracked processes are finalized by their exit handler / watcher; give it a moment.
  const tracked = memoryPid !== undefined;
  const finalized = await waitFor(
    async () => !(await isRunStillRunning(runId)),
    tracked ? FINALIZE_WAIT_MS : 0
  );
  if (!finalized) {
    await finalizeRun(runId, pid, details.command_id, details.group_run_id ?? null, -1, "killed");
  }
  return { stopped: true, forced };
}

export async function stopByCommandId(commandId: number): Promise<StopResult> {
  const runId = await getRunningRunIdByCommandId(commandId);
  if (runId === null) return { stopped: false, forced: false };
  return stopRun(runId);
}

/** Stop the command's running run (if any) and resolve once it is finalized. */
export async function stopByCommandIdAndWait(commandId: number): Promise<StopResult> {
  return stopByCommandId(commandId);
}
