import { getDb } from "../connection";
import type { CommandRow } from "../types";

const db = () => getDb();

export function getCommandById(id: number): CommandRow | undefined {
  return db().prepare("SELECT * FROM commands WHERE id = ?").get(id) as CommandRow | undefined;
}

export function getCommandByIdForRun(
  id: number
): { id: number; name: string; command: string; cwd: string; env: string } | undefined {
  return db()
    .prepare("SELECT id, name, command, cwd, env FROM commands WHERE id = ?")
    .get(id) as { id: number; name: string; command: string; cwd: string; env: string } | undefined;
}

export function insertCommand(
  name: string,
  command: string,
  cwd: string,
  env: string
): number {
  const result = db()
    .prepare("INSERT INTO commands (name, command, cwd, env) VALUES (?, ?, ?, ?)")
    .run(name, command, cwd, env);
  return result.lastInsertRowid as number;
}

export function updateCommandName(name: string, id: number): void {
  db().prepare("UPDATE commands SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
}

export function updateCommandCommand(command: string, id: number): void {
  db().prepare("UPDATE commands SET command = ?, updated_at = datetime('now') WHERE id = ?").run(command, id);
}

export function updateCommandCwd(cwd: string, id: number): void {
  db().prepare("UPDATE commands SET cwd = ?, updated_at = datetime('now') WHERE id = ?").run(cwd, id);
}

export function updateCommandEnv(env: string, id: number): void {
  db().prepare("UPDATE commands SET env = ?, updated_at = datetime('now') WHERE id = ?").run(env, id);
}

export function updateCommandLastRun(runId: number, exitCode: number, commandId: number): void {
  db()
    .prepare(
      "UPDATE commands SET last_run_at = (SELECT started_at FROM runs WHERE id = ?), last_exit_code = ? WHERE id = ?"
    )
    .run(runId, exitCode, commandId);
}

export function deleteCommandById(id: number): number {
  return db().prepare("DELETE FROM commands WHERE id = ?").run(id).changes;
}

export function commandExists(id: number): boolean {
  return db().prepare("SELECT id FROM commands WHERE id = ?").pluck(true).get(id) != null;
}

type CommandListRow = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
};

export function listCommandsForList(): CommandListRow[] {
  return db()
    .prepare(
      `SELECT c.id, c.name, c.command, c.cwd, c.env, c.created_at, c.updated_at, c.last_run_at, c.last_exit_code
       FROM commands c
       ORDER BY c.updated_at DESC`
    )
    .all() as CommandListRow[];
}
