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
