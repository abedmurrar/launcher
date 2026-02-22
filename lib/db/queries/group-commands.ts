import { getDb } from "../connection";

export async function getGroupCommandsByGroupId(groupId: number) {
  const db = await getDb();
  return db("group_commands")
    .select("command_id", "sort_order")
    .where("group_id", groupId)
    .orderBy("sort_order", "asc");
}

export async function deleteGroupCommandsByGroupId(groupId: number): Promise<void> {
  const db = await getDb();
  await db("group_commands").where("group_id", groupId).del();
}

export async function insertGroupCommand(
  groupId: number,
  commandId: number,
  sortOrder: number
): Promise<void> {
  const db = await getDb();
  await db("group_commands").insert({
    group_id: groupId,
    command_id: commandId,
    sort_order: sortOrder,
  });
}
