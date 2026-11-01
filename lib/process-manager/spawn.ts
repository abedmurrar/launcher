import { spawn as nodeSpawn, type ChildProcess } from "child_process";
import { once } from "events";
import path from "path";
import fs from "fs";
import { updateRunProcess } from "@/lib/db/queries";
import { pidMap, runIdToPid, groupRunIdToPids, notifyRunStateChange } from "./state";
import { emitLogChunk } from "./log";
import { clearRunFromMaps, finalizeRun } from "./finalize-run";
import { findRunProcesses, getBootId, getProcessStartTime } from "./identity";
import { terminateRun } from "./kill";
import { isProcessGroupAlive } from "./process-utils";
import { fileStdioSupported, openRunFiles, removeRunFiles, type RunFiles } from "./run-files";
import { startTailing } from "./log-tailer";
import { buildChildEnv } from "./child-env";

/** After "exit", how long to wait for stdio to drain ("close") before finalizing anyway. */
const CLOSE_AFTER_EXIT_MS = 2_000;

function resolveCwd(cwd: string): { cwd: string; warning?: string } {
  if (!cwd || cwd.trim() === "") {
    return { cwd: process.cwd() };
  }
  const resolved = path.resolve(cwd);
  if (!fs.existsSync(resolved)) {
    return {
      cwd: process.cwd(),
      warning: `[launcher] working directory not found: ${resolved} (using ${process.cwd()})\n`,
    };
  }
  return { cwd: resolved };
}

/**
 * Spawn a command in its own process group and track it. Resolves with the pid once the
 * process has started; rejects (with the real spawn error when available) if it could not start.
 */
export async function spawnCommand(
  runId: number,
  commandId: number,
  command: string,
  cwd: string,
  env: Record<string, string>,
  groupRunId: number | null
): Promise<number> {
  const resolved = resolveCwd(cwd);
  // The user's environment without the launcher's own NODE_ENV/PORT/npm/PM2/Next state.
  const envWithBase = buildChildEnv(env, runId);

  // POSIX: output goes to files the launcher tails, so the process survives launcher restarts.
  let files: RunFiles | null = null;
  if (fileStdioSupported()) {
    try {
      files = openRunFiles(runId);
    } catch (err) {
      console.error(`[run ${runId}] could not create log files, falling back to pipes:`, err);
    }
  }

  let child: ChildProcess;
  try {
    child = nodeSpawn(command, {
      shell: true,
      cwd: resolved.cwd,
      // Next's typings require NODE_ENV on ProcessEnv; it is deliberately absent here.
      env: envWithBase as unknown as NodeJS.ProcessEnv,
      detached: process.platform !== "win32",
      // Pipe fallback: stdin stays an open pipe (as before) since some tools exit on stdin EOF.
      stdio: files?.stdio ?? ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    files?.closeParentFds();
    if (files) removeRunFiles(runId);
    console.error("[run] spawn failed:", err instanceof Error ? err.message : err);
    throw err;
  } finally {
    // The child has its own copies now.
    files?.closeParentFds();
  }

  const pid = child.pid;
  if (pid === undefined || pid <= 0) {
    // Spawn failed asynchronously; the reason arrives as an "error" event.
    const [err] = (await Promise.race([
      once(child, "error"),
      new Promise((resolve) => setTimeout(() => resolve([new Error("Failed to start process")]), 1_000)),
    ])) as [Error];
    console.error("[run] spawn failed:", err.message);
    if (files) removeRunFiles(runId);
    throw err;
  }

  // Identity of the process: (pid, start time, boot). A bare pid can be reused later.
  const pidStartTime = getProcessStartTime(pid);
  pidMap.set(pid, { childProcess: child, commandId, runId, groupRunId });
  runIdToPid.set(runId, pid);
  if (groupRunId !== null) {
    const pids = groupRunIdToPids.get(groupRunId) ?? [];
    pids.push(pid);
    groupRunIdToPids.set(groupRunId, pids);
  }

  if (resolved.warning) emitLogChunk(runId, resolved.warning, "stderr");
  if (files) startTailing(runId);

  // Pipe mode only (no-ops with file stdio). Decode as UTF-8 via StringDecoder so multi-byte
  // characters split across chunks stay intact.
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (data: string) => emitLogChunk(runId, data, "stdout"));
  child.stderr?.on("data", (data: string) => emitLogChunk(runId, data, "stderr"));
  child.stdout?.on("error", (err) => console.error(`[run ${runId}] stdout error:`, err.message));
  child.stderr?.on("error", (err) => console.error(`[run ${runId}] stderr error:`, err.message));

  let finished = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;

  const finish = (code: number | null, signal: NodeJS.Signals | null, failed = false) => {
    if (finished) return;
    finished = true;
    if (closeTimer !== null) clearTimeout(closeTimer);

    const record = clearRunFromMaps(runId, pid);
    const resolvedCommandId = record?.commandId ?? commandId;
    const resolvedGroupRunId = record?.groupRunId ?? groupRunId;

    void (async () => {
      // The main process is gone: stop anything it left running (background children holding
      // ports/CPU). The group id is still valid while members exist; matches are limited to
      // processes started after the leader.
      const leftovers =
        process.platform === "linux"
          ? findRunProcesses(runId, pid, pidStartTime).length > 0
          : isProcessGroupAlive(pid);
      if (leftovers) await terminateRun(runId, pid);
      await finalizeRun(runId, pid, resolvedCommandId, resolvedGroupRunId, code, {
        clearMaps: false,
        signal,
        reason: failed ? "failed" : undefined,
      });
    })().catch((err) => console.error("[run] finalize failed:", err));
  };

  child.on("error", (err) => {
    console.error(`[run ${runId}] process error:`, err.message);
    emitLogChunk(runId, `[launcher] process error: ${err.message}\n`, "stderr");
    if (child.exitCode !== null || child.signalCode !== null) {
      finish(child.exitCode, child.signalCode, true);
    }
  });

  child.on("exit", (code, signal) => {
    exitInfo = { code, signal };
    // Background grandchildren may hold stdio open; don't wait on them forever.
    closeTimer = setTimeout(() => finish(code, signal), CLOSE_AFTER_EXIT_MS);
  });

  child.on("close", (code, signal) => {
    finish(exitInfo?.code ?? code, exitInfo?.signal ?? signal);
  });

  try {
    await updateRunProcess(runId, pid, pidStartTime, getBootId());
  } catch (err) {
    console.error("[run] updateRunProcess failed:", err);
  }
  notifyRunStateChange();

  return pid;
}
