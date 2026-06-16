import {
  updateRunFinished,
  updateCommandLastRun,
  getGroupRunStatusById,
  countRunningRunsByGroupRunId,
  updateGroupRunFinishedSuccess,
} from "@/lib/db/queries";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange, notifyLogFinished } from "./state";
import { killGroupRun } from "./kill";
import { finishRunLog } from "./log";
import { stopWatcher } from "./adopted-watchers";

export type RunFinalStatus = "success" | "failed" | "killed";

export function clearRunFromMaps(
  runId: number,
  pid: number
): { commandId: number; groupRunId: number | null } | null {
  const record = pidMap.get(pid);
  pidMap.delete(pid);
  runIdToPid.delete(runId);
  if (record?.groupRunId != null) {
    const pids = groupRunIdToPids.get(record.groupRunId);
    if (pids) {
      const idx = pids.indexOf(pid);
      if (idx !== -1) pids.splice(idx, 1);
      if (pids.length === 0) groupRunIdToPids.delete(record.groupRunId);
    }
  }
  return record ?? null;
}

export async function finalizeRun(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null,
  exitCode: number,
  status: RunFinalStatus,
  options?: { clearMaps?: boolean; signal?: string | null; code?: number | null }
): Promise<void> {
  stopWatcher(runId);

  if (options?.clearMaps !== false) {
    clearRunFromMaps(runId, pid);
  }

  await updateRunFinished(runId, exitCode, status);
  await updateCommandLastRun(runId, exitCode, commandId);

  if (groupRunId != null) {
    const code = options?.code ?? exitCode;
    const signal = options?.signal ?? null;
    const groupRunStatus = await getGroupRunStatusById(groupRunId);
    if (groupRunStatus === "running" && (code !== 0 || signal)) {
      await killGroupRun(groupRunId);
    } else {
      const runningCount = await countRunningRunsByGroupRunId(groupRunId);
      if (runningCount === 0) {
        await updateGroupRunFinishedSuccess(groupRunId);
      }
    }
  }

  notifyLogFinished(runId);
  finishRunLog(runId);
  notifyRunStateChange();
}
