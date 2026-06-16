import { isProcessAlive } from "./process-utils";
import { pidMap, runIdToPid, groupRunIdToPids } from "./state";
import { finalizeRun } from "./finalize-run";
import { hasWatcher, registerWatcher, stopWatcher } from "./adopted-watchers";

const POLL_INTERVAL_MS = 1000;

export function adoptRun(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null
): void {
  pidMap.set(pid, { commandId, runId, groupRunId });
  runIdToPid.set(runId, pid);
  if (groupRunId !== null) {
    const pids = groupRunIdToPids.get(groupRunId) ?? [];
    if (!pids.includes(pid)) {
      pids.push(pid);
    }
    groupRunIdToPids.set(groupRunId, pids);
  }
  startWatcher(runId, pid, commandId, groupRunId);
}

function startWatcher(
  runId: number,
  pid: number,
  commandId: number,
  groupRunId: number | null
): void {
  if (hasWatcher(runId)) return;

  const interval = setInterval(() => {
    if (!isProcessAlive(pid)) {
      stopWatcher(runId);
      void finalizeRun(runId, pid, commandId, groupRunId, -1, "killed", {
        clearMaps: true,
      }).catch((err) => console.error("[run] adopted process exit handler failed:", err));
    }
  }, POLL_INTERVAL_MS);

  registerWatcher(runId, interval);
}

export { stopWatcher } from "./adopted-watchers";
