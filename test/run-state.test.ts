import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { afterAll, describe, expect, it } from "vitest";
import { runCommand, stopCommand } from "@/lib/actions";
import { buildCommandsList } from "@/lib/commands-list";
import { getDb } from "@/lib/db/connection";
import { getRunDetailsById, insertRun } from "@/lib/db/queries";
import { getDataDir } from "@/lib/config";
import { acquireInstanceLock, InstanceLockError, releaseInstanceLock } from "@/lib/instance-lock";
import { findRunProcesses, getBootId, getProcessStartTime, runMarkerValue } from "@/lib/process-manager/identity";
import { reconcileStaleRuns, superviseOnce } from "@/lib/process-manager/supervisor";
import { runIdToPid } from "@/lib/process-manager/state";
import { isProcessAlive } from "@/lib/process-manager/process-utils";
import { ok, createCommand, simulateLauncherCrash, waitFor, waitForRunStatus } from "./helpers";

const linux = process.platform === "linux";
const strangers: number[] = [];

/** A process the launcher knows nothing about (stand-in for a reused pid). */
function startStranger(env: Record<string, string> = {}): number {
  const child = spawn("sleep", ["60"], { detached: true, stdio: "ignore", env: { ...process.env, ...env } });
  child.unref();
  strangers.push(child.pid!);
  return child.pid!;
}

afterAll(() => {
  for (const pid of strangers) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // gone
    }
  }
});

async function runRow(runId: number) {
  const db = await getDb();
  return db("runs").where("id", runId).first();
}

async function fakeRunningRun(fields: Record<string, unknown>): Promise<number> {
  const commandId = await createCommand("sleep 60");
  const runId = await insertRun(commandId);
  const db = await getDb();
  await db("runs").where("id", runId).update(fields);
  return runId;
}

describe("run identity and reconciliation", () => {
  it("never adopts or signals a reused pid (start time mismatch)", async () => {
    const stranger = startStranger();
    const runId = await fakeRunningRun({ pid: stranger, pid_start_time: "1", boot_id: getBootId() });
    await reconcileStaleRuns();
    const row = await runRow(runId);
    expect(row).toMatchObject({ status: "killed", end_reason: "launcher_down", exit_code: null });
    expect(runIdToPid.has(runId)).toBe(false);
    expect(isProcessAlive(stranger)).toBe(true); // untouched
  });

  it("marks runs from a previous boot as ended by reboot without signaling anything", async () => {
    const stranger = startStranger();
    const runId = await fakeRunningRun({
      pid: stranger,
      pid_start_time: getProcessStartTime(stranger),
      boot_id: "some-previous-boot",
    });
    await reconcileStaleRuns();
    expect(await runRow(runId)).toMatchObject({ status: "killed", end_reason: "reboot", exit_code: null });
    expect(isProcessAlive(stranger)).toBe(true);
  });

  it("a process that died while the launcher was down ends as launcher_down", async () => {
    const id = await createCommand("sleep 60");
    const { run_id: runId, pid } = ok(await runCommand(id));
    await simulateLauncherCrash();
    process.kill(-pid, "SIGKILL");
    await waitFor(() => !isProcessAlive(pid));
    await reconcileStaleRuns();
    expect(await runRow(runId)).toMatchObject({ status: "killed", end_reason: "launcher_down", exit_code: null });
    const item = (await buildCommandsList()).find((c) => c.id === id);
    expect(item).toMatchObject({ running: false, last_end_reason: "launcher_down" });
  });

  it.runIf(linux)("adopts a run whose pid was never recorded, via its marker", async () => {
    const runId = await fakeRunningRun({ pid: null });
    const live = startStranger({ LAUNCHER_RUN_ID: runMarkerValue(runId) });
    await reconcileStaleRuns();
    expect(runIdToPid.get(runId)).toBe(live);
    expect(await runRow(runId)).toMatchObject({ status: "running", pid: live });
    // And it can be stopped through the launcher.
    const details = await getRunDetailsById(runId);
    expect(await stopCommand(details!.command_id)).toMatchObject({ success: true });
    expect(isProcessAlive(live)).toBe(false);
  });

  it("the periodic sweep heals drift (DB says running, process is gone)", async () => {
    const id = await createCommand("sleep 60");
    const { run_id: runId, pid } = ok(await runCommand(id));
    await simulateLauncherCrash(); // forget it in memory, as if an event was missed
    process.kill(-pid, "SIGKILL");
    await waitFor(() => !isProcessAlive(pid));
    const db = await getDb();
    await db("runs").where("id", runId).update({ started_at: db.raw("datetime('now', '-1 minute')") });
    await superviseOnce({ sweep: true });
    expect(await runRow(runId)).toMatchObject({ status: "killed", end_reason: "ended" });
  });
});

describe("end reasons", () => {
  it("user stop → stopped; external kill → signal; clean exit → exited; failure → failed", async () => {
    const a = await createCommand("sleep 60");
    const ra = ok(await runCommand(a));
    await stopCommand(a);
    expect(await runRow(ra.run_id)).toMatchObject({ end_reason: "stopped" });

    const b = await createCommand("sleep 60");
    const rb = ok(await runCommand(b));
    process.kill(rb.pid, "SIGKILL");
    expect(await waitForRunStatus(rb.run_id, "killed")).toBe(true);
    expect(await runRow(rb.run_id)).toMatchObject({ end_reason: "signal:SIGKILL" });

    const c = await createCommand("true");
    const rc = ok(await runCommand(c));
    expect(await waitForRunStatus(rc.run_id, "success")).toBe(true);
    expect(await runRow(rc.run_id)).toMatchObject({ end_reason: "exited", exit_code: 0 });

    const d = await createCommand("exit 3");
    const rd = ok(await runCommand(d));
    expect(await waitForRunStatus(rd.run_id, "failed")).toBe(true);
    expect(await runRow(rd.run_id)).toMatchObject({ end_reason: "failed", exit_code: 3 });
  });
});

describe("leftover processes", () => {
  it.runIf(linux)("are stopped when the main process exits", async () => {
    const id = await createCommand("sleep 300 & echo started");
    const { run_id: runId } = ok(await runCommand(id));
    expect(await waitForRunStatus(runId, "success")).toBe(true);
    expect(await waitFor(() => findRunProcesses(runId).length === 0, 5_000)).toBe(true);
    expect(await runRow(runId)).toMatchObject({ end_reason: "exited" });
  });
});

describe("instance lock", () => {
  const lockFile = () => path.join(getDataDir(), "launcher.lock");

  it("refuses when another live launcher holds the lock, takes over stale locks", () => {
    const other = startStranger();
    fs.mkdirSync(getDataDir(), { recursive: true });
    fs.writeFileSync(
      lockFile(),
      JSON.stringify({ pid: other, startTime: getProcessStartTime(other), bootId: getBootId() })
    );
    expect(() => acquireInstanceLock()).toThrow(InstanceLockError);

    // Same pid but a different start time = reused pid = stale.
    fs.writeFileSync(lockFile(), JSON.stringify({ pid: other, startTime: "1", bootId: getBootId() }));
    expect(() => acquireInstanceLock()).not.toThrow();
    expect(JSON.parse(fs.readFileSync(lockFile(), "utf8")).pid).toBe(process.pid);
    releaseInstanceLock();
    expect(fs.existsSync(lockFile())).toBe(false);
  });
});

describe("stopping adopted runs", () => {
  it("records 'stopped' even if the supervisor notices the exit first", async () => {
    const id = await createCommand("sleep 60");
    const { run_id: runId } = ok(await runCommand(id));
    await simulateLauncherCrash();
    await reconcileStaleRuns(); // adopted now
    const stopping = stopCommand(id);
    await superviseOnce(); // supervisor races the stop
    await stopping;
    expect(await runRow(runId)).toMatchObject({ status: "killed", end_reason: "stopped" });
  });
});
