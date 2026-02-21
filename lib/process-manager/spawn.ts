import { spawn as nodeSpawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import {
  updateRunPid,
  updateRunFinished,
  updateCommandLastRun,
  getGroupRunStatusById,
  countRunningRunsByGroupRunId,
  updateGroupRunFinishedSuccess,
} from "@/lib/db/queries";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange, notifyLogFinished } from "./state";
import { killProcessGroup } from "./kill";
import { killGroupRun } from "./kill";
import { emitLogChunk, finishRunLog } from "./log";

function resolveCwd(cwd: string): string {
  if (!cwd || cwd.trim() === "") {
    return process.cwd();
  }
  const resolved = path.resolve(cwd);
  if (!fs.existsSync(resolved)) {
    return process.cwd();
  }
  return resolved;
}

export function spawnCommand(
  runId: number,
  commandId: number,
  command: string,
  cwd: string,
  env: Record<string, string>,
  groupRunId: number | null
): number {
  const resolvedCwd = resolveCwd(cwd);
  const envWithBase = { ...process.env, ...env };

  let child: ChildProcess;
  try {
    child = nodeSpawn(command, {
      shell: true,
      cwd: resolvedCwd,
      env: envWithBase,
      detached: process.platform !== "win32",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to spawn process";
    console.error("[run] spawn failed:", msg);
    throw err;
  }

  const pid = child.pid ?? 0;
  pidMap.set(pid, { childProcess: child, commandId, runId, groupRunId });
  runIdToPid.set(runId, pid);
  if (groupRunId !== null) {
    const pids = groupRunIdToPids.get(groupRunId) ?? [];
    pids.push(pid);
    groupRunIdToPids.set(groupRunId, pids);
  }

  updateRunPid(pid, runId);
  notifyRunStateChange();

  child.stdout?.on("data", (data: Buffer) => {
    emitLogChunk(runId, data.toString(), "stdout");
  });
  child.stderr?.on("data", (data: Buffer) => {
    emitLogChunk(runId, data.toString(), "stderr");
  });

  child.on("exit", (code, signal) => {
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

    const status =
      signal != null ? "killed" : code === 0 ? "success" : "failed";
    const exitCode = code ?? (signal ? -1 : 0);

    updateRunFinished(runId, exitCode, status);
    updateCommandLastRun(runId, exitCode, commandId);

    if (record?.groupRunId != null) {
      const groupRunStatus = getGroupRunStatusById(record.groupRunId);
      if (groupRunStatus === "running" && (code !== 0 || signal)) {
        killGroupRun(record.groupRunId);
      } else {
        const runningCount = countRunningRunsByGroupRunId(record.groupRunId);
        if (runningCount === 0) {
          updateGroupRunFinishedSuccess(record.groupRunId);
        }
      }
    }

    notifyLogFinished(runId);
    finishRunLog(runId);
    notifyRunStateChange();
  });

  return pid;
}
