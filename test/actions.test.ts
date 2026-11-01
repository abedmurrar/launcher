import { describe, expect, it } from "vitest";
import {
  runCommand,
  restartCommand,
  stopCommand,
  deleteCommand,
  createGroup,
  setGroupCommands,
  runGroup,
  stopGroup,
  restartGroup,
  stopAll,
} from "@/lib/actions";
import { buildCommandsList } from "@/lib/commands-list";
import {
  getRunDetailsById,
  getLastGroupRunByGroupId,
  getRunningRunIdByCommandId,
  runExists,
  insertRun,
} from "@/lib/db/queries";
import { ok, createCommand, waitFor, waitForRunStatus } from "./helpers";

describe("command actions", () => {
  it("starts exactly one run for concurrent run requests", async () => {
    const id = await createCommand("sleep 30");
    const results = await Promise.all([runCommand(id), runCommand(id), runCommand(id)]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success && r.code === 409)).toHaveLength(2);
    await stopCommand(id);
  });

  it("enforces one running run per command at the DB level", async () => {
    const id = await createCommand("sleep 30");
    const first = await runCommand(id);
    expect(first.success).toBe(true);
    await expect(insertRun(id)).rejects.toMatchObject({ code: "SQLITE_CONSTRAINT_UNIQUE" });
    await stopCommand(id);
  });

  it("restart replaces the running run", async () => {
    const id = await createCommand("sleep 30");
    const first = await runCommand(id);
    const second = await restartCommand(id);
    expect(second.success).toBe(true);
    expect(ok(second).run_id).not.toBe(ok(first).run_id);
    expect((await getRunDetailsById(ok(first).run_id))?.status).toBe("killed");
    expect(await getRunningRunIdByCommandId(id)).toBe(ok(second).run_id);
    await stopCommand(id);
  });

  it("stop of a non-running command is a 404", async () => {
    const id = await createCommand("true");
    expect(await stopCommand(id)).toMatchObject({ success: false, code: 404 });
  });

  it("refuses to delete a running command; deleting cascades runs and logs", async () => {
    const id = await createCommand("echo bye; sleep 30");
    const run = await runCommand(id);
    expect(await deleteCommand(id)).toMatchObject({ success: false, code: 409 });
    await stopCommand(id);
    expect(await deleteCommand(id)).toMatchObject({ success: true });
    expect(await runExists(ok(run).run_id)).toBe(false);
  });
});

describe("group actions", () => {
  async function makeGroup(commands: string[]) {
    const ids = [];
    for (const c of commands) ids.push(await createCommand(c));
    const group = await createGroup({ name: `g-${Date.now()}-${Math.random()}` });
    const groupId = (ok(group) as { id: number }).id;
    expect((await setGroupCommands(groupId, { commandIds: ids })).success).toBe(true);
    return { groupId, ids };
  }

  it("a failing member stops the rest and marks the group failed", async () => {
    const { groupId, ids } = await makeGroup(["sleep 30", "sleep 0.2; exit 1"]);
    const result = await runGroup(groupId);
    expect(result.success).toBe(true);
    const sleeperRun = ok(result).runs.find((r) => r.command_id === ids[0])!.run_id;
    expect(await waitForRunStatus(sleeperRun, "killed")).toBe(true);
    expect(await waitFor(async () => (await getLastGroupRunByGroupId(groupId))?.status === "failed")).toBe(true);
  });

  it("does not start any member if one is already running", async () => {
    const { groupId, ids } = await makeGroup(["sleep 30", "sleep 30"]);
    await runCommand(ids[1]);
    expect(await runGroup(groupId)).toMatchObject({ success: false, code: 409 });
    expect(await getRunningRunIdByCommandId(ids[0])).toBeNull();
    await stopCommand(ids[1]);
  });

  it("stop and restart", async () => {
    const { groupId } = await makeGroup(["sleep 30"]);
    const first = await runGroup(groupId);
    const restarted = await restartGroup(groupId);
    expect(restarted.success).toBe(true);
    expect(ok(restarted).group_run_id).not.toBe(ok(first).group_run_id);
    expect(await stopGroup(groupId)).toMatchObject({ success: true });
    expect((await getLastGroupRunByGroupId(groupId))?.status).toBe("killed");
  });

  it("rejects unknown member ids with 400", async () => {
    const { groupId } = await makeGroup([]);
    expect(await setGroupCommands(groupId, { commandIds: [999_999] })).toMatchObject({
      success: false,
      code: 400,
    });
  });
});

describe("stop all and list status", () => {
  it("stops every running group and command", async () => {
    const solo = await createCommand("sleep 30");
    const stubborn = await createCommand("trap '' TERM; while true; do sleep 0.1; done");
    const member = await createCommand("sleep 30");
    const group = await createGroup({ name: `stop-all-${Date.now()}` });
    const groupId = (ok(group) as { id: number }).id;
    await setGroupCommands(groupId, { commandIds: [member] });
    await runCommand(solo);
    await runCommand(stubborn);
    await runGroup(groupId);
    await new Promise((r) => setTimeout(r, 200));

    const result = await stopAll();
    expect(result).toMatchObject({ success: true, data: { stopped: 3, forced: true } });
    for (const id of [solo, stubborn, member]) {
      expect(await getRunningRunIdByCommandId(id)).toBeNull();
    }
    expect((await getLastGroupRunByGroupId(groupId))?.status).toBe("killed");
    expect(await stopAll()).toMatchObject({ success: true, data: { stopped: 0, forced: false } });
  });

  it("exposes the last run status in the commands list", async () => {
    const id = await createCommand("exit 2");
    const run = await runCommand(id);
    await waitForRunStatus(ok(run).run_id, "failed");
    const item = (await buildCommandsList()).find((c) => c.id === id);
    expect(item).toMatchObject({ last_run_status: "failed", last_exit_code: 2, running: false });
  });
});
