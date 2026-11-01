import { describe, expect, it } from "vitest";
import {
  autoRestartAfterStartup,
  createCommand as createCommandAction,
  createGroup,
  dismissRestore,
  getRestoreOffers,
  restoreAll,
  runCommand,
  runGroup,
  setGroupCommands,
  stopCommand,
  updateCommand,
} from "@/lib/actions";
import { getDb } from "@/lib/db/connection";
import { getCommandById, getRunningRunIdByCommandId, insertRun } from "@/lib/db/queries";
import { reconcileStaleRuns } from "@/lib/process-manager/supervisor";
import { isProcessAlive } from "@/lib/process-manager/process-utils";
import { ok, createCommand, simulateLauncherCrash, waitFor } from "./helpers";

async function crashAndKill(pids: number[]) {
  await simulateLauncherCrash();
  for (const pid of pids) process.kill(-pid, "SIGKILL");
  await waitFor(() => pids.every((p) => !isProcessAlive(p)));
}

async function cleanOffers() {
  await dismissRestore();
}

describe("restore offers", () => {
  it("offers commands that ended while the launcher was down; Restore starts them", async () => {
    await cleanOffers();
    const id = await createCommand("sleep 60", "restore-me");
    const { pid } = ok(await runCommand(id));
    await crashAndKill([pid]);
    await reconcileStaleRuns();

    const offers = await getRestoreOffers();
    expect(offers).toEqual([
      expect.objectContaining({ kind: "command", targetId: id, name: "restore-me", reason: "launcher_down" }),
    ]);

    expect(await restoreAll()).toMatchObject({ success: true, data: { restored: 1, failed: [] } });
    expect(await getRunningRunIdByCommandId(id)).not.toBeNull();
    expect(await getRestoreOffers()).toEqual([]);
    await stopCommand(id);
  });

  it("offers a group (once) when its members ended by reboot", async () => {
    await cleanOffers();
    const a = await createCommand("sleep 60");
    const b = await createCommand("sleep 60");
    const g = ok(await createGroup({ name: "rebooted-group" })) as { id: number };
    await setGroupCommands(g.id, { commandIds: [a, b] });
    const run = ok(await runGroup(g.id));
    await crashAndKill(run.runs.map((r) => r.pid));
    const db = await getDb();
    await db("runs").whereIn("id", run.runs.map((r) => r.run_id)).update({ boot_id: "previous-boot" });
    await reconcileStaleRuns();

    const offers = await getRestoreOffers();
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ kind: "group", targetId: g.id, reason: "reboot" });
    await cleanOffers();
    expect(await getRestoreOffers()).toEqual([]);
  });

  it("does not offer runs stopped by the user", async () => {
    await cleanOffers();
    const id = await createCommand("sleep 60");
    ok(await runCommand(id));
    await stopCommand(id);
    await reconcileStaleRuns();
    expect(await getRestoreOffers()).toEqual([]);
  });
});

describe("auto-restart", () => {
  it("persists the setting via create/update", async () => {
    const created = ok(
      await createCommandAction({ name: "auto-cmd", command: "true", cwd: "/tmp", env: {}, autoRestart: true })
    ) as { id: number; auto_restart: boolean };
    expect(created.auto_restart).toBe(true);
    await updateCommand(created.id, { autoRestart: false });
    expect((await getCommandById(created.id))?.auto_restart).toBe(0);
  });

  it("restarts offered auto-restart commands at startup", async () => {
    await cleanOffers();
    const created = ok(
      await createCommandAction({ name: "auto-back", command: "sleep 60", cwd: "/tmp", env: {}, autoRestart: true })
    ) as { id: number };
    const { pid } = ok(await runCommand(created.id));
    await crashAndKill([pid]);
    await reconcileStaleRuns();

    const result = await autoRestartAfterStartup();
    expect(result.restarted).toEqual(["auto-back"]);
    expect(await getRunningRunIdByCommandId(created.id)).not.toBeNull();
    expect(await getRestoreOffers()).toEqual([]);
    await stopCommand(created.id);
  });

  it("skips crash-looping commands and keeps the offer", async () => {
    await cleanOffers();
    const created = ok(
      await createCommandAction({ name: "looper", command: "sleep 60", cwd: "/tmp", env: {}, autoRestart: true })
    ) as { id: number };
    // Three previous runs that each died within seconds.
    const db = await getDb();
    for (let i = 0; i < 3; i++) {
      const runId = await insertRun(created.id);
      await db("runs").where("id", runId).update({
        status: "failed",
        end_reason: "failed",
        started_at: db.raw("datetime('now', '-1 minute')"),
        finished_at: db.raw("datetime('now', '-1 minute', '+2 seconds')"),
      });
    }
    const { pid } = ok(await runCommand(created.id));
    await db("runs").where({ command_id: created.id, status: "running" }).update({
      started_at: db.raw("datetime('now', '-3 seconds')"),
    });
    await crashAndKill([pid]);
    await reconcileStaleRuns();

    const result = await autoRestartAfterStartup();
    expect(result.restarted).toEqual([]);
    expect(result.skipped).toEqual(["looper"]);
    expect(await getRunningRunIdByCommandId(created.id)).toBeNull();
    expect(await getRestoreOffers()).toEqual([expect.objectContaining({ name: "looper" })]);
    await cleanOffers();
  });
});
