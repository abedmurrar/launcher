import {
  getAllRunningRuns,
  getAllRunningGroupRuns,
  updateRunFinished,
  updateCommandLastRun,
  updateRunsKilledByGroupRunId,
  countRunningRunsByGroupRunId,
  updateGroupRunKilled,
} from "@/lib/db/queries";
import { notifyRunStateChange } from "./state";
import { getSystemBootTime, isProcessAlive, parseSqliteDatetime } from "./process-utils";
import { adoptRun } from "./watch-adopted";

export async function reconcileStaleRuns(): Promise<void> {
  const bootTime = getSystemBootTime();
  let changed = false;

  const runningRuns = await getAllRunningRuns();
  for (const run of runningRuns) {
    const startedAt = parseSqliteDatetime(run.started_at);
    const beforeBoot = startedAt < bootTime;
    const pid = run.pid ?? 0;
    const alive = !beforeBoot && pid > 0 && isProcessAlive(pid);

    if (alive) {
      adoptRun(run.id, pid, run.command_id, run.group_run_id);
      continue;
    }

    await updateRunFinished(run.id, -1, "killed");
    await updateCommandLastRun(run.id, -1, run.command_id);
    changed = true;
  }

  const runningGroupRuns = await getAllRunningGroupRuns();
  for (const groupRun of runningGroupRuns) {
    const startedAt = parseSqliteDatetime(groupRun.started_at);
    if (startedAt < bootTime) {
      await updateGroupRunKilled(groupRun.id);
      await updateRunsKilledByGroupRunId(groupRun.id);
      changed = true;
      continue;
    }

    const runningCount = await countRunningRunsByGroupRunId(groupRun.id);
    if (runningCount === 0) {
      await updateGroupRunKilled(groupRun.id);
      changed = true;
    }
  }

  if (changed) {
    notifyRunStateChange();
  }
}
