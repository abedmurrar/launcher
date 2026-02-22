import { updateGroupRunFailed, updateRunsKilledByGroupRunId } from "@/lib/db/queries";
import { pidMap, groupRunIdToPids } from "./state";

export function killProcessGroup(pid: number, signal: NodeJS.Signals | number): boolean {
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

export async function killGroupRun(groupRunId: number): Promise<void> {
  const pids = groupRunIdToPids.get(groupRunId);
  if (pids) {
    pids.forEach((p) => killProcessGroup(p, "SIGTERM"));
    groupRunIdToPids.delete(groupRunId);
  }
  await updateGroupRunFailed(groupRunId);
  await updateRunsKilledByGroupRunId(groupRunId);
}
