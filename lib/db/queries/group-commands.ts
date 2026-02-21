import { getDb } from "../connection";
import type { GroupCommandRow } from "../types";

const db = () => getDb();

export function getGroupCommandsByGroupId(
  groupId: number
): Array<{ command_id: number; sort_order: number }> {
  return db()
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(groupId) as Array<{ command_id: number; sort_order: number }>;
}

export function deleteGroupCommandsByGroupId(groupId: number): void {
  db().prepare("DELETE FROM group_commands WHERE group_id = ?").run(groupId);
}

export function insertGroupCommand(
  groupId: number,
  commandId: number,
  sortOrder: number
): void {
  db()
    .prepare(
      "INSERT INTO group_commands (group_id, command_id, sort_order) VALUES (?, ?, ?)"
    )
    .run(groupId, commandId, sortOrder);
}
