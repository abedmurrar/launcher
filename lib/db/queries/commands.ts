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

export async function listCommandsForList() {
  const db = await getDb();
  return db("commands")
    .select(
      "id",
      "name",
      "command",
      "cwd",
      "env",
      "created_at",
      "updated_at",
      "last_run_at",
      "last_exit_code"
    )
    .orderByRaw("last_run_at IS NOT NULL DESC, last_run_at DESC");
}
