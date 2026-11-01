import { getDb } from "../connection";

export async function getCommandById(id: number) {
  const db = await getDb();
  return db("commands").where("id", id).first();
}

export async function getCommandByIdForRun(id: number) {
  const db = await getDb();
  return db("commands").select("id", "name", "command", "cwd", "env").where("id", id).first();
}

export async function insertCommand(
  name: string,
  command: string,
  cwd: string,
  env: string
): Promise<number> {
  const db = await getDb();
  const [id] = await db("commands").insert({ name, command, cwd, env });
  return id;
}

export async function updateCommandName(name: string, id: number): Promise<void> {
  const db = await getDb();
  await db("commands").where("id", id).update({ name, updated_at: db.raw("datetime('now')") });
}

export async function updateCommandCommand(command: string, id: number): Promise<void> {
  const db = await getDb();
  await db("commands").where("id", id).update({ command, updated_at: db.raw("datetime('now')") });
}

export async function updateCommandCwd(cwd: string, id: number): Promise<void> {
  const db = await getDb();
  await db("commands").where("id", id).update({ cwd, updated_at: db.raw("datetime('now')") });
}

export async function updateCommandEnv(env: string, id: number): Promise<void> {
  const db = await getDb();
  await db("commands").where("id", id).update({ env, updated_at: db.raw("datetime('now')") });
}

export async function updateCommandLastRun(runId: number, exitCode: number, commandId: number): Promise<void> {
  const db = await getDb();
  await db("commands")
    .where("id", commandId)
    .update({
      last_run_at: db.raw("(SELECT started_at FROM runs WHERE id = ?)", [runId]),
      last_exit_code: exitCode,
    });
}

export async function deleteCommandById(id: number): Promise<number> {
  const db = await getDb();
  const deleted = await db("commands").where("id", id).del();
  return deleted;
}

export async function commandExists(id: number): Promise<boolean> {
  const db = await getDb();
  const row = await db("commands").select("id").where("id", id).first();
  return row != null;
}

export interface CommandListRow {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  /** Running run id/pid, if any. */
  run_id: number | null;
  run_pid: number | null;
  /** Most recent run id, if any. */
  last_run_id: number | null;
}

/** Commands with their running run and latest run, in one query (most recently run first). */
export async function listCommandsForList(): Promise<CommandListRow[]> {
  const db = await getDb();
  return (await db.raw(
    `SELECT c.id, c.name, c.command, c.cwd, c.env, c.created_at, c.updated_at,
            c.last_run_at, c.last_exit_code,
            r.id AS run_id, r.pid AS run_pid,
            (SELECT lr.id FROM runs lr WHERE lr.command_id = c.id ORDER BY lr.id DESC LIMIT 1) AS last_run_id
     FROM commands c
     LEFT JOIN runs r ON r.command_id = c.id AND r.status = 'running'
     ORDER BY c.last_run_at IS NOT NULL DESC, c.last_run_at DESC`
  )) as CommandListRow[];
}

/** Update any subset of a command's editable fields in one statement. */
export async function updateCommandFields(
  id: number,
  fields: { name?: string; command?: string; cwd?: string; env?: string }
): Promise<void> {
  const patch = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return;
  const db = await getDb();
  await db("commands").where("id", id).update({ ...patch, updated_at: db.raw("datetime('now')") });
}
