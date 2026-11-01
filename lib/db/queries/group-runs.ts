import { getDb } from "../connection";

export async function getRunningGroupRunIdByGroupId(groupId: number): Promise<number | undefined> {
  const db = await getDb();
  const row = await db("group_runs")
    .select("id")
    .where({ group_id: groupId, status: "running" })
    .first();
  return row?.id;
}

export async function getLastGroupRunByGroupId(groupId: number) {
  const db = await getDb();
  return db("group_runs")
    .select("id", "started_at", "finished_at", "status")
    .where("group_id", groupId)
    .orderBy("started_at", "desc")
    .first();
}

export async function insertGroupRun(groupId: number) {
  const db = await getDb();
  const [id] = await db("group_runs").insert({ group_id: groupId, status: "running" });
  return id;
}

export async function getGroupRunStatusById(id: number): Promise<string | undefined> {
  const db = await getDb();
  const row = await db("group_runs").select("status").where("id", id).first();
  return row?.status;
}

export async function updateGroupRunFailed(id: number): Promise<void> {
  const db = await getDb();
  await db("group_runs")
    .where("id", id)
    .update({ finished_at: db.raw("datetime('now')"), status: "failed" });
}

export async function updateGroupRunFinishedSuccess(id: number): Promise<void> {
  const db = await getDb();
  await db("group_runs")
    .where({ id, status: "running" })
    .update({ finished_at: db.raw("datetime('now')"), status: "success" });
}

export interface RunningGroupRunRow {
  id: number;
  group_id: number;
  started_at: string;
}

export async function getAllRunningGroupRuns(): Promise<RunningGroupRunRow[]> {
  const db = await getDb();
  const rows = await db("group_runs")
    .select("id", "group_id", "started_at")
    .where("status", "running");
  return rows as RunningGroupRunRow[];
}

export async function updateGroupRunKilled(id: number): Promise<void> {
  const db = await getDb();
  await db("group_runs")
    .where("id", id)
    .update({ finished_at: db.raw("datetime('now')"), status: "killed" });
}

/** Set the status of a group run that is still running (no-op once it has finished). */
export async function updateGroupRunStatus(id: number, status: "success" | "failed" | "killed"): Promise<void> {
  const db = await getDb();
  await db("group_runs")
    .where({ id, status: "running" })
    .update({ finished_at: db.raw("datetime('now')"), status });
}

export interface LastGroupRunRow {
  id: number;
  group_id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
}

/** The most recent group run of every group (one query). */
export async function listLastGroupRuns(): Promise<LastGroupRunRow[]> {
  const db = await getDb();
  return (await db.raw(
    `SELECT id, group_id, started_at, finished_at, status FROM (
       SELECT id, group_id, started_at, finished_at, status,
              ROW_NUMBER() OVER (PARTITION BY group_id ORDER BY started_at DESC, id DESC) AS rn
       FROM group_runs
     ) WHERE rn = 1`
  )) as LastGroupRunRow[];
}

/** Running group run id per group. */
export async function listRunningGroupRuns(): Promise<{ id: number; group_id: number }[]> {
  const db = await getDb();
  return db("group_runs").select("id", "group_id").where("status", "running");
}
