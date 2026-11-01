import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.LAUNCHER_LOG_FILE_COMPACT_BYTES = String(50 * 1024);
});

import { runCommand, stopCommand } from "@/lib/actions";
import { getRunDetailsById } from "@/lib/db/queries";
import { reconcileStaleRuns } from "@/lib/process-manager/supervisor";
import { runIdToPid } from "@/lib/process-manager/state";
import { isProcessAlive } from "@/lib/process-manager/process-utils";
import {
  getLogsDir,
  removeStrayRunFiles,
  runFilePaths,
  utf8SafeLength,
} from "@/lib/process-manager/run-files";
import {
  ok,
  createCommand,
  runLogText,
  simulateLauncherCrash,
  waitFor,
  waitForRunStatus,
} from "./helpers";

const linux = process.platform === "linux";

function lineNumbers(text: string): number[] {
  return text
    .split("\n")
    .filter((l) => l.startsWith("line "))
    .map((l) => Number(l.slice(5)));
}

describe("file-backed run output", () => {
  it.runIf(linux)("wires stdout/stderr to files and stdin to a FIFO", async () => {
    const id = await createCommand("sleep 30");
    const { run_id: runId, pid } = ok(await runCommand(id));
    const paths = runFilePaths(runId);
    expect(fs.readlinkSync(`/proc/${pid}/fd/0`)).toContain(paths.stdin);
    expect(fs.readlinkSync(`/proc/${pid}/fd/1`)).toBe(paths.stdout);
    expect(fs.readlinkSync(`/proc/${pid}/fd/2`)).toBe(paths.stderr);
    expect(fs.statSync(paths.stdin).isFIFO()).toBe(true);
    await stopCommand(id);
    // Files are removed once the run is finalized.
    expect(fs.existsSync(paths.stdout)).toBe(false);
    expect(fs.existsSync(paths.stdin)).toBe(false);
  });

  it("stdin never reaches EOF", async () => {
    const id = await createCommand("if read x; then echo got-line; else echo got-eof; fi");
    const { run_id: runId } = ok(await runCommand(id));
    await new Promise((r) => setTimeout(r, 400));
    expect((await getRunDetailsById(runId))?.status).toBe("running");
    expect(await runLogText(runId)).toBe("");
    await stopCommand(id);
  });

  it("keeps stdout and stderr separate", async () => {
    const id = await createCommand("echo out; echo err >&2");
    const { run_id: runId } = ok(await runCommand(id));
    expect(await waitForRunStatus(runId, "success")).toBe(true);
    const { getLogChunksFullByRunId } = await import("@/lib/db/queries");
    const chunks = await getLogChunksFullByRunId(runId);
    expect(chunks.filter((c) => c.stream_type === "stdout").map((c) => c.content).join("")).toBe("out\n");
    expect(chunks.filter((c) => c.stream_type === "stderr").map((c) => c.content).join("")).toBe("err\n");
  });

  it("a chatty process survives a launcher crash and its log stays complete", async () => {
    const id = await createCommand("i=0; while true; do i=$((i+1)); echo line $i; sleep 0.005; done");
    const { run_id: runId, pid } = ok(await runCommand(id));
    await waitFor(async () => lineNumbers(await runLogText(runId)).length > 50);

    await simulateLauncherCrash();
    const beforeCrash = lineNumbers(await runLogText(runId)).length;
    await new Promise((r) => setTimeout(r, 400)); // keeps writing while "the launcher is down"
    expect(isProcessAlive(pid)).toBe(true);

    await reconcileStaleRuns();
    expect(runIdToPid.get(runId)).toBe(pid);
    await waitFor(async () => lineNumbers(await runLogText(runId)).length > beforeCrash + 50);

    expect(await stopCommand(id)).toMatchObject({ success: true });
    expect(await waitForRunStatus(runId, "killed")).toBe(true);
    expect(isProcessAlive(pid)).toBe(false);

    const nums = lineNumbers(await runLogText(runId));
    expect(nums.length).toBeGreaterThan(beforeCrash + 50);
    expect(nums.every((n, i) => n === i + 1)).toBe(true); // contiguous: no gaps, no duplicates
    expect(fs.existsSync(runFilePaths(runId).stdout)).toBe(false);
  });

  it("ingests output written while the launcher was down by a process that then exited", async () => {
    const id = await createCommand("sleep 0.5; echo late-line");
    const { run_id: runId } = ok(await runCommand(id));
    await simulateLauncherCrash();
    await new Promise((r) => setTimeout(r, 900)); // process writes and exits meanwhile
    await reconcileStaleRuns();
    expect((await getRunDetailsById(runId))?.status).toBe("killed");
    expect(await runLogText(runId)).toBe("late-line\n");
  });

  it("compacts a fully ingested large log file without losing output", async () => {
    const id = await createCommand(
      "for i in $(seq 1 6000); do echo line $i; done; sleep 30"
    );
    const { run_id: runId } = ok(await runCommand(id));
    const paths = runFilePaths(runId);
    await waitFor(async () => lineNumbers(await runLogText(runId)).length === 6000);
    await waitFor(() => fs.statSync(paths.stdout).size === 0, 3_000);
    expect(fs.statSync(paths.stdout).size).toBe(0);
    const nums = lineNumbers(await runLogText(runId));
    expect(nums.every((n, i) => n === i + 1)).toBe(true);
    await stopCommand(id);
  });

  it("removes stray run files", () => {
    fs.mkdirSync(getLogsDir(), { recursive: true });
    fs.writeFileSync(path.join(getLogsDir(), "424242.stdout"), "x");
    fs.writeFileSync(path.join(getLogsDir(), "unrelated.txt"), "x");
    expect(removeStrayRunFiles(new Set())).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(path.join(getLogsDir(), "424242.stdout"))).toBe(false);
    expect(fs.existsSync(path.join(getLogsDir(), "unrelated.txt"))).toBe(true);
  });
});

describe("utf8SafeLength", () => {
  it("cuts before an incomplete multi-byte sequence", () => {
    const full = Buffer.from("a→世😀", "utf8");
    expect(utf8SafeLength(full)).toBe(full.length);
    for (let cut = 1; cut < full.length; cut++) {
      const part = full.subarray(0, cut);
      const n = utf8SafeLength(part);
      expect(part.subarray(0, n).toString("utf8")).not.toContain("�");
      expect(cut - n).toBeLessThan(4);
    }
  });
});
