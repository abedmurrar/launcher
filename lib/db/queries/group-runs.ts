import { getDb } from "../connection";

const db = () => getDb();

export function getRunningGroupRunIdByGroupId(groupId: number): number | undefined {
  return db()
    .prepare("SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1")
    .pluck(true)
    .get(groupId) as number | undefined;
}

export function getLastGroupRunByGroupId(
  groupId: number
): { id: number; started_at: string; finished_at: string | null; status: string } | undefined {
  return db()
    .prepare(
      "SELECT id, started_at, finished_at, status FROM group_runs WHERE group_id = ? ORDER BY started_at DESC LIMIT 1"
    )
    .get(groupId) as
    | { id: number; started_at: string; finished_at: string | null; status: string }
    | undefined;
}

export function insertGroupRun(groupId: number): number {
  const result = db()
    .prepare("INSERT INTO group_runs (group_id, status) VALUES (?, 'running')")
    .run(groupId);
  return result.lastInsertRowid as number;
}

export function getGroupRunStatusById(id: number): string | undefined {
  return db().prepare("SELECT status FROM group_runs WHERE id = ?").pluck(true).get(id) as string | undefined;
}

export function updateGroupRunFailed(id: number): void {
  db()
    .prepare(
      "UPDATE group_runs SET finished_at = datetime('now'), status = 'failed' WHERE id = ?"
    )
    .run(id);
}

export function updateGroupRunFinishedSuccess(id: number): void {
  db()
    .prepare(
      "UPDATE group_runs SET finished_at = datetime('now'), status = 'success' WHERE id = ? AND status = 'running'"
    )
    .run(id);
}

