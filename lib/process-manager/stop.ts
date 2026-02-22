import { getRunById, getRunningRunIdByCommandId } from "@/lib/db/queries";
import { runIdToPid, pidMap, getRunIdForCommand } from "./state";
import { killProcessGroup } from "./kill";

export async function stopRun(runId: number): Promise<boolean> {
  const pid = runIdToPid.get(runId);
  if (pid !== undefined) {
    const record = pidMap.get(pid);
    if (record?.childProcess) {
      return killProcessGroup(pid, "SIGTERM");
    }
  }
  const row = await getRunById(runId);
  if (row?.pid) {
    return killProcessGroup(row.pid, "SIGTERM");
  }
  return false;
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
