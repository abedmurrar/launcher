import { getAllRunningRuns, listRunningGroupRuns } from "@/lib/db/queries";
import { killGroupRun, stopRun } from "@/lib/process-manager";
import { broadcastCommands } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import { withLock } from "./helpers";
import { ActionResultFactory } from "./result-factory";

/** Stop every running group, then every remaining running command, in parallel. */
export async function stopAll(): Promise<ActionResult<{ stopped: number; forced: boolean }>> {
  const groupRuns = await listRunningGroupRuns();
  const groupResults = await Promise.all(
    groupRuns.map((g) => withLock(`group:${g.group_id}`, () => killGroupRun(g.id, "killed")))
  );

  const runs = await getAllRunningRuns();
  const runResults = await Promise.all(
    runs.map((r) => withLock(`command:${r.command_id}`, () => stopRun(r.id)))
  );

  await broadcastCommands();
  return ActionResultFactory.success({
    stopped: groupRuns.length + runResults.filter((r) => r.stopped).length,
    forced: [...groupResults, ...runResults].some((r) => r.forced),
  });
}
