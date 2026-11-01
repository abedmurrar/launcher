import { describe, expect, it } from "vitest";
import { runCommand, stopCommand } from "@/lib/actions";
import { getRunDetailsById, getCommandById } from "@/lib/db/queries";
import { killProcessGroup } from "@/lib/process-manager/kill";
import { finalizeRun } from "@/lib/process-manager/finalize-run";
import { runIdToPid } from "@/lib/process-manager/state";
import { isProcessGroupAlive } from "@/lib/process-manager/process-utils";
import { ok, createCommand, runLogText, waitFor, waitForRunStatus } from "./helpers";

async function start(command: string) {
  const id = await createCommand(command);
  const result = await runCommand(id);
  if (!result.success) throw new Error(result.error);
  return { commandId: id, runId: ok(result).run_id, pid: ok(result).pid };
}

describe("process manager", () => {
  it("records exit code and status on exit", async () => {
    const { commandId, runId } = await start("echo hi; exit 3");
    expect(await waitForRunStatus(runId, "failed")).toBe(true);
    const run = await getRunDetailsById(runId);
    expect(run?.status).toBe("failed");
    expect((await getCommandById(commandId))?.last_exit_code).toBe(3);
    expect(await runLogText(runId)).toBe("hi\n");
  });

  it("marks a clean exit as success", async () => {
    const { runId } = await start("true");
    expect(await waitForRunStatus(runId, "success")).toBe(true);
  });

  it("stops a well-behaved process without force", async () => {
    const { commandId, runId, pid } = await start("sleep 30");
    const result = await stopCommand(commandId);
    expect(result).toMatchObject({ success: true, data: { forced: false } });
    expect((await getRunDetailsById(runId))?.status).toBe("killed");
    expect(isProcessGroupAlive(pid)).toBe(false);
    expect(runIdToPid.has(runId)).toBe(false);
  });

  it("SIGKILLs a process that ignores SIGTERM after the grace period", async () => {
    const { commandId, runId, pid } = await start("trap '' TERM; echo ready; while true; do sleep 0.1; done");
    await waitFor(async () => (await runLogText(runId)).includes("ready"), 5_000);
    const t0 = Date.now();
    const result = await stopCommand(commandId);
    expect(result).toMatchObject({ success: true, data: { forced: true } });
    expect(Date.now() - t0).toBeGreaterThanOrEqual(450);
    expect(isProcessGroupAlive(pid)).toBe(false);
    expect((await getRunDetailsById(runId))?.status).toBe("killed");
  });

  it("never signals pid <= 0", () => {
    expect(killProcessGroup(0, 0)).toBe(false);
    expect(killProcessGroup(-1, 0)).toBe(false);
    expect(killProcessGroup(NaN, 0)).toBe(false);
  });

  it("finalizes a run only once", async () => {
    const { commandId, runId } = await start("true");
    expect(await waitForRunStatus(runId, "success")).toBe(true);
    // A late duplicate finalize (e.g. stop racing exit) must not overwrite the result.
    await finalizeRun(runId, 0, commandId, null, null, { reason: "stopped" });
    expect((await getRunDetailsById(runId))?.status).toBe("success");
  });

  it("keeps multi-byte UTF-8 intact across output chunks", async () => {
    const { runId } = await start("for i in $(seq 1 3000); do printf 'héllo→世界 '; done");
    expect(await waitForRunStatus(runId, "success")).toBe(true);
    const text = await runLogText(runId);
    expect(text).not.toContain("�");
    expect(text.split("héllo→世界").length - 1).toBe(3000);
  });

  it("reports spawn into a missing cwd as a warning, not a crash", async () => {
    const { insertCommand } = await import("@/lib/db/queries");
    const id = await insertCommand("bad-cwd", "echo ok", "/definitely/not/here", "{}");
    const result = await runCommand(id);
    expect(result.success).toBe(true);
    const runId = ok(result).run_id;
    expect(await waitForRunStatus(runId, "success")).toBe(true);
    const text = await runLogText(runId);
    expect(text).toContain("working directory not found");
    expect(text).toContain("ok");
  });
});
