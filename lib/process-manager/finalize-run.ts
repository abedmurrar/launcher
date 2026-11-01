import {
  updateRunFinished,
  updateCommandLastRun,
  getGroupRunStatusById,
  countRunningRunsByGroupRunId,
  updateGroupRunFinishedSuccess,
} from "@/lib/db/queries";
import { globalSingleton } from "@/lib/global-singleton";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange, notifyLogFinished } from "./state";
import { killGroupRun } from "./kill";
import { finishRunLog } from "./log";
import { stopWatcher } from "./adopted-watchers";

export type RunFinalStatus = "success" | "failed" | "killed";

/** Run ids already finalized (exit handler, stop, watcher can race). Entries expire. */
const finalizedRuns = globalSingleton("finalized-runs", () => new Set<number>());
const FINALIZED_TTL_MS = 60_000;

export function clearRunFromMaps(
  runId: number,
  pid: number
): { commandId: number; groupRunId: number | null } | null {
  const record = pidMap.get(pid);
  if (record && record.runId === runId) pidMap.delete(pid);
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

/** Mark a run finished exactly once: flush logs, update DB, settle its group run, notify observers. */
export async function finalizeRun(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null,
  exitCode: number,
  status: RunFinalStatus,
  options?: { clearMaps?: boolean; signal?: string | null; code?: number | null }
): Promise<void> {
  if (finalizedRuns.has(runId)) return;
  finalizedRuns.add(runId);
  setTimeout(() => finalizedRuns.delete(runId), FINALIZED_TTL_MS).unref?.();

  stopWatcher(runId);
  if (options?.clearMaps !== false) {
    clearRunFromMaps(runId, pid);
  }

  try {
    await finishRunLog(runId);
    await updateRunFinished(runId, exitCode, status);
    await updateCommandLastRun(runId, exitCode, commandId);

    if (groupRunId != null) {
      const code = options?.code ?? exitCode;
      const signal = options?.signal ?? null;
      const groupRunStatus = await getGroupRunStatusById(groupRunId);
      if (groupRunStatus === "running" && (code !== 0 || signal)) {
        // A member failed: stop the rest. Not awaited so this run's own completion isn't delayed.
        void killGroupRun(groupRunId, "failed")
          .then(() => notifyRunStateChange())
          .catch((err) => console.error("[run] killGroupRun failed:", err));
      } else if ((await countRunningRunsByGroupRunId(groupRunId)) === 0) {
        await updateGroupRunFinishedSuccess(groupRunId);
      }
    }
  } finally {
    notifyLogFinished(runId);
    notifyRunStateChange();
  }
}
