import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { getDb } from "./db";

type RunRecord = {
  childProcess: ChildProcess;
  commandId: number;
  runId: number;
  groupRunId: number | null;
};

const pidMap = new Map<number, RunRecord>();
const runIdToPid = new Map<number, number>();
const groupRunIdToPids = new Map<number, number[]>();

type SSEWriter = (data: string, streamType: "stdout" | "stderr") => void;
const sseWriters = new Map<number, Set<SSEWriter>>();

export function registerSSEWriter(runId: number, writer: SSEWriter): () => void {
  if (!sseWriters.has(runId)) {
    sseWriters.set(runId, new Set());
  }
  sseWriters.get(runId)!.add(writer);
  return () => {
    sseWriters.get(runId)?.delete(writer);
  };
}

function emitLogChunk(runId: number, content: string, streamType: "stdout" | "stderr") {
  const db = getDb();
  db.prepare(
    "INSERT INTO log_chunks (run_id, stream_type, content, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(runId, streamType, content);

  const writers = sseWriters.get(runId);
  if (writers) {
    writers.forEach((w) => w(content, streamType));
  }
}

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
  const db = getDb();
  const resolvedCwd = resolveCwd(cwd);
  const envWithBase = { ...process.env, ...env };

  const child = spawn(command, {
    shell: true,
    cwd: resolvedCwd,
    env: envWithBase,
    // So the shell and all its children share a process group we can kill together (Unix).
    detached: process.platform !== "win32",
  });

  const pid = child.pid ?? 0;
  pidMap.set(pid, { childProcess: child, commandId, runId, groupRunId });
  runIdToPid.set(runId, pid);
  if (groupRunId !== null) {
    const pids = groupRunIdToPids.get(groupRunId) ?? [];
    pids.push(pid);
    groupRunIdToPids.set(groupRunId, pids);
  }

  db.prepare("UPDATE runs SET pid = ? WHERE id = ?").run(pid, runId);

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
    if (record?.groupRunId !== null && record?.groupRunId !== undefined) {
      const pids = groupRunIdToPids.get(record.groupRunId);
      if (pids) {
        const idx = pids.indexOf(pid);
        if (idx !== -1) pids.splice(idx, 1);
        if (pids.length === 0) groupRunIdToPids.delete(record.groupRunId);
      }
    }

    const status =
      signal !== null && signal !== undefined
        ? "killed"
        : code === 0
          ? "success"
          : "failed";
    const exitCode = code ?? (signal ? -1 : 0);

    db.prepare(
      "UPDATE runs SET finished_at = datetime('now'), exit_code = ?, status = ? WHERE id = ?"
    ).run(exitCode, status, runId);

    db.prepare(
      "UPDATE commands SET last_run_at = (SELECT started_at FROM runs WHERE id = ?), last_exit_code = ? WHERE id = ?"
    ).run(runId, exitCode, commandId);

    if (record?.groupRunId != null) {
      const groupRun = db.prepare("SELECT status FROM group_runs WHERE id = ?").get(record.groupRunId) as { status: string } | undefined;
      if (groupRun?.status === "running" && (code !== 0 || signal)) {
        killGroupRun(record.groupRunId);
      } else {
        const runningInGroup = db
          .prepare("SELECT COUNT(*) as c FROM runs WHERE group_run_id = ? AND status = 'running'")
          .get(record.groupRunId) as { c: number };
        if (runningInGroup.c === 0) {
          db.prepare(
            "UPDATE group_runs SET finished_at = datetime('now'), status = 'success' WHERE id = ? AND status = 'running'"
          ).run(record.groupRunId);
        }
      }
    }

    sseWriters.get(runId)?.forEach((w) => w("[run finished]", "stdout"));
    sseWriters.delete(runId);
  });

  return pid;
}

function killGroupRun(groupRunId: number) {
  const pids = groupRunIdToPids.get(groupRunId);
  const db = getDb();
  if (pids) {
    pids.forEach((p) => killProcessGroup(p, "SIGTERM"));
    groupRunIdToPids.delete(groupRunId);
  }
  db.prepare(
    "UPDATE group_runs SET finished_at = datetime('now'), status = 'failed' WHERE id = ?"
  ).run(groupRunId);
  db.prepare(
    "UPDATE runs SET finished_at = datetime('now'), status = 'killed' WHERE group_run_id = ? AND status = 'running'"
  ).run(groupRunId);
}

function killProcessGroup(pid: number, signal: NodeJS.Signals | number): boolean {
  try {
    if (process.platform !== "win32") {
      // Kill the whole process group (shell + children); -pid = process group led by pid.
      process.kill(-pid, signal);
    } else {
      process.kill(pid, signal);
    }
    return true;
  } catch {
    return false;
  }
}

export function stopRun(runId: number): boolean {
  const pid = runIdToPid.get(runId);
  if (pid !== undefined) {
    const record = pidMap.get(pid);
    if (record?.childProcess) {
      return killProcessGroup(pid, "SIGTERM");
    }
  }
  const db = getDb();
  const row = db.prepare("SELECT pid FROM runs WHERE id = ? AND status = 'running'").get(runId) as { pid: number } | undefined;
  if (row?.pid) {
    return killProcessGroup(row.pid, "SIGTERM");
  }
  return false;
}

export function stopByCommandId(commandId: number): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM runs WHERE command_id = ? AND status = 'running' LIMIT 1")
    .get(commandId) as { id: number } | undefined;
  if (row) return stopRun(row.id);
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stops the running command (if any) and waits for the process to exit before resolving.
 * Uses SIGTERM first; if still running after timeoutMs, sends SIGKILL.
 * @param timeoutMs Max time to wait for exit (default 10000). 0 means no timeout (wait indefinitely).
 */
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

export function getRunningRunIds(): number[] {
  return Array.from(runIdToPid.keys());
}

export function getRunIdForCommand(commandId: number): number | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id FROM runs WHERE command_id = ? AND status = 'running' LIMIT 1")
    .get(commandId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function isRunLive(runId: number): boolean {
  return runIdToPid.has(runId);
}
