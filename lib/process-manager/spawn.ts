import { spawn as nodeSpawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { updateRunPid } from "@/lib/db/queries";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange } from "./state";
import { emitLogChunk } from "./log";
import { clearRunFromMaps, finalizeRun } from "./finalize-run";

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

  void updateRunPid(pid, runId).catch((err) => console.error("[run] updateRunPid failed:", err));
  notifyRunStateChange();

  child.stdout?.on("data", (data: Buffer) => {
    emitLogChunk(runId, data.toString(), "stdout");
  });
  child.stderr?.on("data", (data: Buffer) => {
    emitLogChunk(runId, data.toString(), "stderr");
  });

  child.on("exit", (code, signal) => {
    const record = clearRunFromMaps(runId, pid);
    const resolvedCommandId = record?.commandId ?? commandId;
    const resolvedGroupRunId = record?.groupRunId ?? groupRunId;
    const status = signal != null ? "killed" : code === 0 ? "success" : "failed";
    const exitCode = code ?? (signal ? -1 : 0);

    void finalizeRun(runId, pid, resolvedCommandId, resolvedGroupRunId, exitCode, status, {
      clearMaps: false,
      signal,
      code,
    }).catch((err) => console.error("[run] exit handler failed:", err));
  });

  return pid;
}
