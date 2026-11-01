import {
  getAllRunningRuns,
  getAllRunningGroupRuns,
  countRunningRunsByGroupRunId,
  updateGroupRunKilled,
  updateRunProcess,
  type RunningRunRow,
} from "@/lib/db/queries";
import { globalSingleton } from "@/lib/global-singleton";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange, isOwnedRun } from "./state";
import { getSystemBootTime, parseSqliteDatetime } from "./process-utils";
import { findRunProcesses, getBootId, getProcessGroup, isSameProcess } from "./identity";
import { startTailing, isTailing } from "./log-tailer";
import { removeStrayRunFiles, runFilesExist } from "./run-files";
import { finalizeRun } from "./finalize-run";
import { terminateRun } from "./kill";
import type { EndReason } from "./types";

/**
 * Supervisor: keeps the DB's idea of "running" equal to reality.
 *
 * - Startup tick (= reconciliation): every run still marked running is adopted if its exact
 *   process is alive (pid + start time + boot id), otherwise ended with reason `reboot` or
 *   `launcher_down` (output written meanwhile is ingested first, leftovers are stopped).
 * - Every TICK_MS: adopted runs (processes started by a previous launcher) are re-checked.
 * - Every SWEEP_EVERY ticks: a DB sweep heals any drift (missed events, failed writes, ...).
 * One timer for everything, regardless of how many runs exist.
 */

const TICK_MS = 2_000;
const SWEEP_EVERY = 5;
/** Don't touch runs younger than this in periodic sweeps (spawn may still be recording the pid). */
const YOUNG_RUN_MS = 10_000;

interface Adopted {
  run: RunningRunRow;
  pid: number;
}

const state = globalSingleton("supervisor", () => ({
  adopted: new Map<number, Adopted>(),
  timer: null as ReturnType<typeof setInterval> | null,
  ticking: false,
  ticks: 0,
}));

export function forgetAdopted(runId: number): void {
  state.adopted.delete(runId);
}

export function isAdopted(runId: number): boolean {
  return state.adopted.has(runId);
}

function adopt(run: RunningRunRow, pid: number): void {
  pidMap.set(pid, { commandId: run.command_id, runId: run.id, groupRunId: run.group_run_id });
  runIdToPid.set(run.id, pid);
  if (run.group_run_id !== null) {
    const pids = groupRunIdToPids.get(run.group_run_id) ?? [];
    if (!pids.includes(pid)) pids.push(pid);
    groupRunIdToPids.set(run.group_run_id, pids);
  }
  state.adopted.set(run.id, { run, pid });
  if (runFilesExist(run.id) && !isTailing(run.id)) {
    startTailing(run.id, { stdout: run.stdout_offset ?? 0, stderr: run.stderr_offset ?? 0 });
  }
}

/** End a run whose main process is gone: stop leftovers, ingest remaining output, finalize. */
async function endRun(run: RunningRunRow, reason: EndReason): Promise<void> {
  // Leftover descendants (identified by the run marker only: the leader's pid may be reused).
  if (reason !== "reboot") await terminateRun(run.id, null);
  if (runFilesExist(run.id) && !isTailing(run.id)) {
    startTailing(run.id, { stdout: run.stdout_offset ?? 0, stderr: run.stderr_offset ?? 0 });
  }
  await finalizeRun(run.id, run.pid ?? 0, run.command_id, run.group_run_id, null, { clearMaps: true, reason });
}

function identityOf(run: RunningRunRow, pid: number | null = run.pid) {
  return { pid, pidStartTime: run.pid_start_time, bootId: run.boot_id, startedAt: run.started_at };
}

/** One supervision pass. `startup` marks the reconciliation pass at launcher start. */
export async function superviseOnce(opts: { startup?: boolean; sweep?: boolean } = {}): Promise<void> {
  if (state.ticking) return;
  state.ticking = true;
  let changed = false;
  try {
    // 1. Adopted runs: cheap in-memory identity check.
    for (const { run, pid } of [...state.adopted.values()]) {
      if (!isSameProcess(identityOf(run, pid))) {
        await endRun(run, opts.startup ? "launcher_down" : "ended");
        changed = true;
      }
    }

    // 2. DB sweep: anything marked running that we don't track.
    if (opts.startup || opts.sweep || state.ticks % SWEEP_EVERY === 0) {
      const bootId = getBootId();
      const bootTime = getSystemBootTime();
      for (const run of await getAllRunningRuns()) {
        if (isOwnedRun(run.id) || state.adopted.has(run.id)) continue;

        const rebooted = run.boot_id
          ? run.boot_id !== bootId
          : parseSqliteDatetime(run.started_at) < bootTime;
        if (rebooted) {
          await endRun(run, "reboot");
          changed = true;
          continue;
        }

        if (run.pid && isSameProcess(identityOf(run))) {
          adopt(run, run.pid);
          changed = true;
          continue;
        }

        if (!opts.startup && Date.now() - parseSqliteDatetime(run.started_at).getTime() < YOUNG_RUN_MS) {
          continue; // spawn may still be in progress
        }

        // Launcher died between spawning and recording the pid: find the process by its marker.
        if (!run.pid) {
          const live = findRunProcesses(run.id, null);
          if (live.length > 0) {
            const leader = live.find((p) => getProcessGroup(p.pid) === p.pid) ?? live[0];
            await updateRunProcess(run.id, leader.pid, leader.startTime, bootId);
            adopt({ ...run, pid: leader.pid, pid_start_time: leader.startTime, boot_id: bootId }, leader.pid);
            changed = true;
            continue;
          }
        }

        await endRun(run, opts.startup ? "launcher_down" : "ended");
        changed = true;
      }

      // 3. Group runs whose members have all ended.
      for (const groupRun of await getAllRunningGroupRuns()) {
        if ((await countRunningRunsByGroupRunId(groupRun.id)) === 0) {
          await updateGroupRunKilled(groupRun.id);
          changed = true;
        }
      }
    }

    if (opts.startup) {
      const keep = new Set<number>([...state.adopted.keys(), ...runIdToPid.keys()]);
      const strays = removeStrayRunFiles(keep);
      if (strays > 0) console.log(`[supervisor] removed ${strays} stray run log files`);
    }
  } finally {
    state.ticking = false;
    state.ticks++;
  }
  if (changed) notifyRunStateChange();
}

/** Startup reconciliation (kept for callers/tests). */
export function reconcileStaleRuns(): Promise<void> {
  return superviseOnce({ startup: true });
}

/** Reconcile, then keep supervising. Idempotent. */
export async function startSupervisor(): Promise<void> {
  await superviseOnce({ startup: true });
  if (state.timer) return;
  state.timer = setInterval(() => {
    void superviseOnce().catch((err) => console.error("[supervisor] tick failed:", err));
  }, TICK_MS);
  state.timer.unref?.();
}

export function stopSupervisor(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}
