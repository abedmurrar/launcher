import { getDb } from "@/lib/db";
import { getRunIdForCommand } from "@/lib/process-manager";

export type CommandListItem = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  running: boolean;
  run_id?: number;
  last_run_id?: number;
  pid?: number;
};

export function buildCommandsList(): CommandListItem[] {
  const db = getDb();
  const commands = db
    .prepare(
      `SELECT c.id, c.name, c.command, c.cwd, c.env, c.created_at, c.updated_at, c.last_run_at, c.last_exit_code
       FROM commands c
       ORDER BY c.updated_at DESC`
    )
    .all() as Array<{
    id: number;
    name: string;
    command: string;
    cwd: string;
    env: string;
    created_at: string;
    updated_at: string;
    last_run_at: string | null;
    last_exit_code: number | null;
  }>;

  return commands.map((c) => {
    const runId = getRunIdForCommand(c.id);
    const pid =
      runId != null
        ? (db.prepare("SELECT pid FROM runs WHERE id = ?").get(runId) as { pid: number } | undefined)?.pid
        : null;
    const lastRun = db
      .prepare("SELECT id FROM runs WHERE command_id = ? ORDER BY started_at DESC LIMIT 1")
      .get(c.id) as { id: number } | undefined;
    return {
      id: c.id,
      name: c.name,
      command: c.command,
      cwd: c.cwd,
      env: typeof c.env === "string" ? (JSON.parse(c.env || "{}") as Record<string, string>) : c.env,
      created_at: c.created_at,
      updated_at: c.updated_at,
      last_run_at: c.last_run_at,
      last_exit_code: c.last_exit_code,
      running: runId !== null,
      run_id: runId ?? undefined,
      last_run_id: lastRun?.id,
      pid: pid ?? undefined,
    };
  });
}
