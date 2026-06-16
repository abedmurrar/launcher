import { getDb } from "../connection";

/** Running run id for a command, or null. */
export async function getRunningRunIdByCommandId(commandId: number): Promise<number | null> {
  const db = await getDb();
  const row = await db("runs")
    .select("id")
    .where({ command_id: commandId, status: "running" })
    .first();
  return row?.id ?? null;
}

export async function getRunById(runId: number) {
  const db = await getDb();
  return db("runs").select("pid").where({ id: runId, status: "running" }).first();
}

export async function getRunCommandId(runId: number) {
  const db = await getDb();
  return db("runs").select("command_id").where("id", runId).first();
}

export async function runExists(runId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db("runs").select("id").where("id", runId).first();
  return row != null;
}

export async function insertRun(commandId: number): Promise<number> {
  const db = await getDb();
  const [id] = await db("runs").insert({ command_id: commandId, status: "running" });
  return id;
}

export async function insertRunWithGroup(commandId: number, groupRunId: number) {
  const db = await getDb();
  const [id] = await db("runs").insert({
    command_id: commandId,
    group_run_id: groupRunId,
    status: "running",
  });
  return id;
}

export async function updateRunStatusFailed(runId: number): Promise<void> {
  const db = await getDb();
  await db("runs").where("id", runId).update({ status: "failed" });
}

export async function updateRunPid(pid: number, runId: number): Promise<void> {
  const db = await getDb();
  await db("runs").where("id", runId).update({ pid });
}

export async function updateRunFinished(runId: number, exitCode: number, status: string): Promise<void> {
  const db = await getDb();
  await db("runs")
    .where("id", runId)
    .update({ finished_at: db.raw("datetime('now')"), exit_code: exitCode, status });
}

export async function getPidByRunId(runId: number) {
  const db = await getDb();
  const row = await db("runs").select("pid").where("id", runId).first();
  return row?.pid ?? undefined;
}

export async function getRunByIdFull(runId: number) {
  const db = await getDb();
  return db("runs").select("id", "pid", "started_at", "status").where("id", runId).first();
}

export async function getRunDetailsById(runId: number) {
  const db = await getDb();
  return db("runs")
    .select("id", "pid", "command_id", "group_run_id", "status")
    .where("id", runId)
    .first();
}

export async function getLastRunByCommandId(commandId: number) {
  const db = await getDb();
  return db("runs").select("id").where("command_id", commandId).orderBy("started_at", "desc").first();
}

export async function getLastRunByCommandIdFull(commandId: number) {
  const db = await getDb();
  return db("runs")
    .select("id", "started_at", "finished_at", "exit_code", "status")
    .where("command_id", commandId)
    .orderBy("started_at", "desc")
    .first();
}

export async function updateRunsKilledByGroupRunId(groupRunId: number): Promise<void> {
  const db = await getDb();
  await db("runs")
    .where({ group_run_id: groupRunId, status: "running" })
    .update({ finished_at: db.raw("datetime('now')"), status: "killed" });
}

export async function countRunningRunsByGroupRunId(groupRunId: number): Promise<number> {
  const db = await getDb();
  const row = await db("runs")
    .where({ group_run_id: groupRunId, status: "running" })
    .count("* as count")
    .first();
  const count = (row as unknown as { count: number | string })?.count;
  return Number(count ?? 0);
}

export interface RunningRunRow {
  id: number;
  pid: number | null;
  command_id: number;
  group_run_id: number | null;
  started_at: string;
}

export async function getAllRunningRuns(): Promise<RunningRunRow[]> {
  const db = await getDb();
  const rows = await db("runs")
    .select("id", "pid", "command_id", "group_run_id", "started_at")
    .where("status", "running");
  return rows as RunningRunRow[];
}

export async function isRunStillRunning(runId: number): Promise<boolean> {
  const db = await getDb();
  const row = await db("runs").select("id").where({ id: runId, status: "running" }).first();
  return row != null;
}

/** Run id and command name for each run in a group run (for group log viewer). */
export async function getRunsByGroupRunId(groupRunId: number): Promise<{ runId: number; commandName: string }[]> {
  const db = await getDb();
  const rows = await db("runs")
    .join("commands", "runs.command_id", "commands.id")
    .where("runs.group_run_id", groupRunId)
    .select("runs.id as runId", "commands.name as commandName")
    .orderBy("runs.started_at", "asc");
  return rows as { runId: number; commandName: string }[];
}
