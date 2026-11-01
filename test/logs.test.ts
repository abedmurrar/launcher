import { describe, expect, it } from "vitest";
import { runCommand } from "@/lib/actions";
import {
  getLogChunksFullByRunId,
  getLogTailByRunId,
  insertLogChunksBatch,
  insertRun,
  updateRunFinished,
  pruneLogChunks,
} from "@/lib/db/queries";
import { getDb } from "@/lib/db/connection";
import { ok, createCommand, runLogText, waitForRunStatus } from "./helpers";

describe("logs", () => {
  it("batches output into few rows and keeps it complete and ordered", async () => {
    const id = await createCommand("for i in $(seq 1 20000); do echo line $i; done");
    const run = await runCommand(id);
    const runId = ok(run).run_id;
    expect(await waitForRunStatus(runId, "success", 15_000)).toBe(true);
    const rows = await getLogChunksFullByRunId(runId);
    expect(rows.length).toBeLessThan(200);
    const nums = (await runLogText(runId)).trim().split("\n").map((l) => Number(l.slice(5)));
    expect(nums).toHaveLength(20000);
    expect(nums.every((n, i) => n === i + 1)).toBe(true);
  });

  it("tail is capped by size, flagged truncated, and pages backwards", async () => {
    const id = await createCommand("true");
    const runId = await insertRun(id);
    const chunk = "x".repeat(1000);
    await insertLogChunksBatch(
      runId,
      Array.from({ length: 50 }, (_, i) => ({ stream_type: i % 2 ? "stderr" : "stdout", content: chunk }))
    );
    const tail = await getLogTailByRunId(runId, 10_500);
    expect(tail.truncated).toBe(true);
    expect(tail.chunks.length).toBe(11);
    const all = await getLogChunksFullByRunId(runId);
    expect(tail.lastId).toBe(all.at(-1)!.id);
    expect(tail.firstId).toBe(tail.chunks[0].id);

    const page = await getLogChunksFullByRunId(runId, { before: tail.chunks[0].id, limit: 5 });
    expect(page.map((c) => c.id)).toEqual(all.slice(-16, -11).map((c) => c.id));

    const whole = await getLogTailByRunId(runId, 10_000_000);
    expect(whole.truncated).toBe(false);
    expect(whole.chunks).toHaveLength(50);
  });

  it("retention keeps the newest runs and always the latest run", async () => {
    const id = await createCommand("true");
    const runIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const runId = await insertRun(id);
      await insertLogChunksBatch(runId, [{ stream_type: "stdout", content: `run ${i}` }]);
      await updateRunFinished(runId, 0, "success");
      runIds.push(runId);
    }
    // Make every run ancient so the age rule applies to all of them.
    const db = await getDb();
    await db("runs").whereIn("id", runIds).update({ started_at: "2000-01-01 00:00:00" });

    await pruneLogChunks(3, 30);
    const remaining = await Promise.all(runIds.map(async (r) => (await getLogChunksFullByRunId(r)).length));
    expect(remaining).toEqual([0, 0, 0, 0, 1]);
  });

  it("retention by count", async () => {
    const id = await createCommand("true");
    const runIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const runId = await insertRun(id);
      await insertLogChunksBatch(runId, [{ stream_type: "stdout", content: `run ${i}` }]);
      await updateRunFinished(runId, 0, "success");
      runIds.push(runId);
    }
    await pruneLogChunks(2, 0);
    const remaining = await Promise.all(runIds.map(async (r) => (await getLogChunksFullByRunId(r)).length));
    expect(remaining).toEqual([0, 0, 0, 1, 1]);
  });
});
