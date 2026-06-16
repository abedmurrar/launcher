import {
  getRunById,
  getRunningRunIdByCommandId,
  getRunDetailsById,
  isRunStillRunning,
} from "@/lib/db/queries";
import { runIdToPid, pidMap, getRunIdForCommand } from "./state";
import { killProcessGroup } from "./kill";
import { finalizeRun } from "./finalize-run";
import { isProcessAlive } from "./process-utils";

export async function stopRun(runId: number): Promise<boolean> {
  const memoryPid = runIdToPid.get(runId);
  if (memoryPid !== undefined) {
    const record = pidMap.get(memoryPid);
    const sentKill =
      record?.childProcess || memoryPid > 0
        ? killProcessGroup(memoryPid, "SIGTERM")
        : false;
    if (sentKill) {
      return true;
    }
    if (!(await isRunStillRunning(runId))) {
      return true;
    }
  }

  const row = await getRunById(runId);
  if (row?.pid) {
    const killed = killProcessGroup(row.pid, "SIGTERM");
    if (killed) {
      return true;
    }
    if (!isProcessAlive(row.pid)) {
      const details = await getRunDetailsById(runId);
      if (details && details.status === "running") {
        await finalizeRun(
          runId,
          row.pid,
          details.command_id,
          details.group_run_id ?? null,
          -1,
          "killed"
        );
      }
      return true;
    }
    return false;
  }

  const details = await getRunDetailsById(runId);
  if (details && details.status === "running") {
    await finalizeRun(
      runId,
      details.pid ?? 0,
      details.command_id,
      details.group_run_id ?? null,
      -1,
      "killed"
    );
    return true;
  }

  return !(await isRunStillRunning(runId));
}

export async function stopByCommandId(commandId: number): Promise<boolean> {
  const runId = await getRunningRunIdByCommandId(commandId);
  if (runId !== null) return stopRun(runId);
  return false;
}

export async function stopByCommandIdAndWait(
  commandId: number,
  timeoutMs: number = 10_000
): Promise<void> {
  const runId = await getRunIdForCommand(commandId);
  if (runId === null) return;

  await stopRun(runId);

  return new Promise<void>((resolve) => {
    const pollIntervalMs = 50;
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;

    const check = async () => {
      if (!(await isRunStillRunning(runId))) {
        resolve();
        return;
      }
      if (deadline !== null && Date.now() >= deadline) {
        const pid = runIdToPid.get(runId);
        if (pid !== undefined) {
          killProcessGroup(pid, "SIGKILL");
        }
        const details = await getRunDetailsById(runId);
        if (details && details.status === "running") {
          await finalizeRun(
            runId,
            pid ?? details.pid ?? 0,
            details.command_id,
            details.group_run_id ?? null,
            -1,
            "killed"
          );
        }
        resolve();
        return;
      }
      setTimeout(() => {
        void check();
      }, pollIntervalMs);
    };
    void check();
  });
}
