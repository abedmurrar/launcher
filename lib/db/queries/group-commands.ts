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

/** Every group membership row, ordered for display. */
export async function listAllGroupCommands(): Promise<{ group_id: number; command_id: number }[]> {
  const db = await getDb();
  return db("group_commands")
    .select("group_id", "command_id")
    .orderBy([{ column: "group_id" }, { column: "sort_order" }]);
}

/** Replace a group's members in one transaction. */
export async function replaceGroupCommands(groupId: number, commandIds: number[]): Promise<void> {
  const db = await getDb();
  await db.transaction(async (trx) => {
    await trx("group_commands").where("group_id", groupId).del();
    if (commandIds.length > 0) {
      await trx("group_commands").insert(
        commandIds.map((commandId, index) => ({ group_id: groupId, command_id: commandId, sort_order: index }))
      );
    }
  });
}
