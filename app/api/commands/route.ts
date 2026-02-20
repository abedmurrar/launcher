import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRunIdForCommand } from "@/lib/process-manager";
import { z } from "zod";

const createCommandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().default(""),
  env: z.record(z.string(), z.string()).default({}),
});

export async function GET() {
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

  const list = commands.map((c) => {
    const runId = getRunIdForCommand(c.id);
    const pid = runId != null ? (db.prepare("SELECT pid FROM runs WHERE id = ?").get(runId) as { pid: number } | undefined)?.pid : null;
    const lastRun = db.prepare("SELECT id FROM runs WHERE command_id = ? ORDER BY started_at DESC LIMIT 1").get(c.id) as { id: number } | undefined;
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

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, command, cwd, env } = parsed.data;
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO commands (name, command, cwd, env) VALUES (?, ?, ?, ?)"
    )
    .run(name, command, cwd, JSON.stringify(env));
  const id = result.lastInsertRowid as number;
  const row = db.prepare("SELECT * FROM commands WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json({
    id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    env: typeof row.env === "string" ? JSON.parse(row.env as string) : row.env,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at,
    last_exit_code: row.last_exit_code,
  });
}
