import { getRunById, getRunningRunIdByCommandId } from "@/lib/db/queries";
import { runIdToPid, pidMap, getRunIdForCommand } from "./state";
import { killProcessGroup } from "./kill";

export function stopRun(runId: number): boolean {
  const pid = runIdToPid.get(runId);
  if (pid !== undefined) {
    const record = pidMap.get(pid);
    if (record?.childProcess) {
      return killProcessGroup(pid, "SIGTERM");
    }
  }
  const row = getRunById(runId);
  if (row?.pid) {
    return killProcessGroup(row.pid, "SIGTERM");
  }
  return false;
}

export function stopByCommandId(commandId: number): boolean {
  const runId = getRunningRunIdByCommandId(commandId);
  if (runId !== null) return stopRun(runId);
  return false;
}

export function stopByCommandIdAndWait(
  commandId: number,
  timeoutMs: number = 10_000
): Promise<void> {
  const runId = getRunIdForCommand(commandId);
  if (runId === null) return Promise.resolve();

  stopRun(runId);

  return new Promise((resolve) => {
    const pollIntervalMs = 50;
    const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : null;

    const check = () => {
      if (!runIdToPid.has(runId)) {
        resolve();
        return;
      }
      if (deadline !== null && Date.now() >= deadline) {
        const pid = runIdToPid.get(runId);
        if (pid !== undefined) {
          killProcessGroup(pid, "SIGKILL");
        }
        resolve();
        return;
      }
      setTimeout(check, pollIntervalMs);
    };
    check();
  });
}
