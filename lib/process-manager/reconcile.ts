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
import { startTailing, stopTailing } from "./log-tailer";
import { removeRunFiles, removeStrayRunFiles, runFilesExist } from "./run-files";

export async function reconcileStaleRuns(): Promise<void> {
  const bootTime = getSystemBootTime();
  let changed = false;

  const runningRuns = await getAllRunningRuns();
  const adopted = new Set<number>();
  for (const run of runningRuns) {
    const startedAt = parseSqliteDatetime(run.started_at);
    const beforeBoot = startedAt < bootTime;
    const pid = run.pid ?? 0;
    const alive = !beforeBoot && pid > 0 && isProcessAlive(pid);
    const offsets = { stdout: run.stdout_offset ?? 0, stderr: run.stderr_offset ?? 0 };

    if (alive) {
      // Resume ingesting its output from where we left off.
      if (runFilesExist(run.id)) startTailing(run.id, offsets);
      adoptRun(run.id, pid, run.command_id, run.group_run_id);
      adopted.add(run.id);
      continue;
    }

    // Ingest whatever it wrote while the launcher was down, then clean up.
    if (runFilesExist(run.id)) {
      startTailing(run.id, offsets);
      await stopTailing(run.id, { drain: true });
      removeRunFiles(run.id);
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

  const strays = removeStrayRunFiles(adopted);
  if (strays > 0) console.log(`[reconcile] removed ${strays} stray run log files`);

  if (changed) {
    notifyRunStateChange();
  }
}
