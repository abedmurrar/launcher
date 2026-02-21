import { getDb } from "../connection";

const db = () => getDb();

/** Running run id for a command, or null. */
export function getRunningRunIdByCommandId(commandId: number): number | null {
  const id = db()
    .prepare("SELECT id FROM runs WHERE command_id = ? AND status = 'running' LIMIT 1")
    .pluck(true)
    .get(commandId) as number | undefined;
  return id ?? null;
}

export function getRunById(runId: number): { pid: number } | undefined {
  const row = db()
    .prepare("SELECT pid FROM runs WHERE id = ? AND status = 'running'")
    .get(runId) as { pid: number } | undefined;
  return row;
}

export function getRunCommandId(runId: number): { command_id: number } | undefined {
  return db()
    .prepare("SELECT command_id FROM runs WHERE id = ?")
    .get(runId) as { command_id: number } | undefined;
}

export function runExists(runId: number): boolean {
  return db().prepare("SELECT id FROM runs WHERE id = ?").pluck(true).get(runId) != null;
}

export function insertRun(commandId: number): number {
  const result = db()
    .prepare("INSERT INTO runs (command_id, status) VALUES (?, 'running')")
    .run(commandId);
  return result.lastInsertRowid as number;
}

export function insertRunWithGroup(commandId: number, groupRunId: number): number {
  const result = db()
    .prepare(
      "INSERT INTO runs (command_id, group_run_id, status) VALUES (?, ?, 'running')"
    )
    .run(commandId, groupRunId);
  return result.lastInsertRowid as number;
}

export function updateRunStatusFailed(runId: number): void {
  db().prepare("UPDATE runs SET status = 'failed' WHERE id = ?").run(runId);
}

export function updateRunPid(pid: number, runId: number): void {
  db().prepare("UPDATE runs SET pid = ? WHERE id = ?").run(pid, runId);
}

export function updateRunFinished(runId: number, exitCode: number, status: string): void {
  db()
    .prepare(
      "UPDATE runs SET finished_at = datetime('now'), exit_code = ?, status = ? WHERE id = ?"
    )
    .run(exitCode, status, runId);
}

export function getPidByRunId(runId: number): number | undefined {
  return db().prepare("SELECT pid FROM runs WHERE id = ?").pluck(true).get(runId) as number | undefined;
}

export function getRunByIdFull(
  runId: number
): { id: number; pid: number | null; started_at: string; status: string } | undefined {
  return db()
    .prepare("SELECT id, pid, started_at, status FROM runs WHERE id = ?")
    .get(runId) as { id: number; pid: number | null; started_at: string; status: string } | undefined;
}

export function getLastRunByCommandId(
  commandId: number
): { id: number } | undefined {
  return db()
    .prepare("SELECT id FROM runs WHERE command_id = ? ORDER BY started_at DESC LIMIT 1")
    .get(commandId) as { id: number } | undefined;
}

export function getLastRunByCommandIdFull(
  commandId: number
): { id: number; started_at: string; finished_at: string | null; exit_code: number | null; status: string } | undefined {
  return db()
    .prepare("SELECT id, started_at, finished_at, exit_code, status FROM runs WHERE command_id = ? ORDER BY started_at DESC LIMIT 1")
    .get(commandId) as
    | { id: number; started_at: string; finished_at: string | null; exit_code: number | null; status: string }
    | undefined;
}

export function updateRunsKilledByGroupRunId(groupRunId: number): void {
  db()
    .prepare(
      "UPDATE runs SET finished_at = datetime('now'), status = 'killed' WHERE group_run_id = ? AND status = 'running'"
    )
    .run(groupRunId);
}

export function countRunningRunsByGroupRunId(groupRunId: number): number {
  return (db()
    .prepare("SELECT COUNT(*) FROM runs WHERE group_run_id = ? AND status = 'running'")
    .pluck(true)
    .get(groupRunId) as number) ?? 0;
}
