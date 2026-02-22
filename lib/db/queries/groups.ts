import { getDb } from "../connection";

export async function getGroupById(id: number) {
  const db = await getDb();
  return db("groups").where("id", id).first();
}

export async function groupExists(id: number): Promise<boolean> {
  const db = await getDb();
  const row = await db("groups").select("id").where("id", id).first();
  return row != null;
}

export async function insertGroup(name: string): Promise<number> {
  const db = await getDb();
  const [id] = await db("groups").insert({ name });
  return id;
}

export async function updateGroupName(name: string, id: number): Promise<void> {
  const db = await getDb();
  await db("groups").where("id", id).update({ name });
}

export async function deleteGroup(id: number): Promise<number> {
  const db = await getDb();
  return db("groups").where("id", id).del();
}

export async function listGroupsForList() {
  const db = await getDb();
  return db("groups").select("id", "name", "created_at").orderBy("name", "asc");
}
