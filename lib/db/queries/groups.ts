import { getDb } from "../connection";
import type { GroupRow } from "../types";

const db = () => getDb();

export function getGroupById(id: number): GroupRow | undefined {
  return db().prepare("SELECT * FROM groups WHERE id = ?").get(id) as GroupRow | undefined;
}

export function groupExists(id: number): boolean {
  return db().prepare("SELECT id FROM groups WHERE id = ?").pluck(true).get(id) != null;
}

export function insertGroup(name: string): number {
  const result = db().prepare("INSERT INTO groups (name) VALUES (?)").run(name);
  return result.lastInsertRowid as number;
}

export function updateGroupName(name: string, id: number): void {
  db().prepare("UPDATE groups SET name = ? WHERE id = ?").run(name, id);
}

export function deleteGroup(id: number): number {
  return db().prepare("DELETE FROM groups WHERE id = ?").run(id).changes;
}

type GroupListRow = { id: number; name: string; created_at: string };

export function listGroupsForList(): GroupListRow[] {
  return db()
    .prepare(
      `SELECT g.id, g.name, g.created_at
       FROM groups g
       ORDER BY g.name ASC`
    )
    .all() as GroupListRow[];
}
