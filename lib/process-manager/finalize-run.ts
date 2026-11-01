import {
  updateRunFinished,
  updateCommandLastRun,
  getGroupRunStatusById,
  countRunningRunsByGroupRunId,
  updateGroupRunFinishedSuccess,
} from "@/lib/db/queries";
import { globalSingleton } from "@/lib/global-singleton";
import {
  pidMap,
  runIdToPid,
  groupRunIdToPids,
  notifyRunStateChange,
  notifyLogFinished,
  consumeStopReason,
} from "./state";
import { killGroupRun } from "./kill";
import { finishRunLog } from "./log";
import { forgetAdopted } from "./supervisor";
import type { EndReason } from "./types";
import { stopTailing } from "./log-tailer";
import { removeRunFiles } from "./run-files";

export type RunFinalStatus = "success" | "failed" | "killed";

/** Default reason from how the process ended, when the launcher didn't stop it itself. */
export function reasonFromExit(code: number | null, signal: string | null): EndReason {
  if (signal) return `signal:${signal}`;
  return code === 0 ? "exited" : "failed";
}

function statusForReason(reason: EndReason): RunFinalStatus {
  if (reason === "exited") return "success";
  if (reason === "failed" || reason === "spawn_failed") return "failed";
  return "killed";
}

/**
 * Finalization per run (exit handler, stop and supervisor can race). Later callers get the same
 * promise, so "finalized" always means the DB has actually been updated. Entries expire.
 */
const finalizing = globalSingleton("finalizing-runs", () => new Map<number, Promise<void>>());
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
/**
 * Mark a run finished exactly once. `exitCode` is null when unknown. The end reason is, in order:
 * the reason recorded when the launcher stopped it, `options.reason`, or derived from the exit.
 */
export async function finalizeRun(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null,
  exitCode: number | null,
  options?: { clearMaps?: boolean; signal?: string | null; reason?: EndReason }
): Promise<void> {
  const existing = finalizing.get(runId);
  if (existing) return existing;
  const promise = doFinalize(runId, pid, commandId, groupRunId, exitCode, options);
  finalizing.set(runId, promise);
  setTimeout(() => finalizing.delete(runId), FINALIZED_TTL_MS).unref?.();
  return promise;
}

async function doFinalize(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null,
  exitCode: number | null,
  options?: { clearMaps?: boolean; signal?: string | null; reason?: EndReason }
): Promise<void> {
  const signal = options?.signal ?? null;
  // A stop the launcher initiated (user stop, group stop) wins over fallback reasons such as the
  // supervisor's "ended" when it notices the process is gone first.
  const reason = consumeStopReason(runId) ?? options?.reason ?? reasonFromExit(exitCode, signal);
  const status = statusForReason(reason);
  forgetAdopted(runId);
  if (options?.clearMaps !== false) {
    clearRunFromMaps(runId, pid);
  }

  try {
    // Ingest everything the process wrote before marking the run finished.
    await stopTailing(runId, { drain: true });
    await finishRunLog(runId);
    await updateRunFinished(runId, exitCode, status, reason);
    await updateCommandLastRun(runId, exitCode, commandId);

    if (groupRunId != null) {
      const groupRunStatus = await getGroupRunStatusById(groupRunId);
      // Any member ending other than a clean exit takes the rest of the group down (same as
      // before). Stops issued by the group itself already moved it out of "running".
      if (groupRunStatus === "running" && reason !== "exited") {
        // A member failed: stop the rest. Not awaited so this run's own completion isn't delayed.
        void killGroupRun(groupRunId, "failed")
          .then(() => notifyRunStateChange())
          .catch((err) => console.error("[run] killGroupRun failed:", err));
      } else if ((await countRunningRunsByGroupRunId(groupRunId)) === 0) {
        await updateGroupRunFinishedSuccess(groupRunId);
      }
    }
    removeRunFiles(runId);
  } finally {
    notifyLogFinished(runId);
    notifyRunStateChange();
  }
}
