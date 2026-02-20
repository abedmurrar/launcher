import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().min(1),
});

export async function GET() {
  const db = getDb();
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.created_at
       FROM groups g
       ORDER BY g.name ASC`
    )
    .all() as Array<{ id: number; name: string; created_at: string }>;

  const list = groups.map((g) => {
    const commands = db
      .prepare(
        "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
      )
      .all(g.id) as Array<{ command_id: number; sort_order: number }>;
    const lastRun = db
      .prepare(
        "SELECT id, started_at, finished_at, status FROM group_runs WHERE group_id = ? ORDER BY started_at DESC LIMIT 1"
      )
      .get(g.id) as { id: number; started_at: string; finished_at: string | null; status: string } | undefined;
    const runningRun = db
      .prepare(
        "SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1"
      )
      .get(g.id) as { id: number } | undefined;
    return {
      id: g.id,
      name: g.name,
      created_at: g.created_at,
      command_ids: commands.map((c) => c.command_id),
      last_run: lastRun
        ? {
            id: lastRun.id,
            started_at: lastRun.started_at,
            finished_at: lastRun.finished_at,
            status: lastRun.status,
          }
        : undefined,
      running: !!runningRun,
      running_group_run_id: runningRun?.id,
    };
  });

  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const db = getDb();
  const result = db.prepare("INSERT INTO groups (name) VALUES (?)").run(parsed.data.name);
  const id = result.lastInsertRowid as number;
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Record<string, unknown>;
  return NextResponse.json(row);
}
