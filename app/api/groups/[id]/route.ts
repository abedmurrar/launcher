import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { updateGroup, deleteGroup } from "@/lib/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const commands = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(id) as Array<{ command_id: number; sort_order: number }>;
  const lastRun = db
    .prepare(
      "SELECT id, started_at, finished_at, status FROM group_runs WHERE group_id = ? ORDER BY started_at DESC LIMIT 1"
    )
    .get(id) as Record<string, unknown> | undefined;
  const runningRun = db
    .prepare("SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1")
    .get(id) as { id: number } | undefined;

  return NextResponse.json({
    ...row,
    command_ids: commands.map((c) => c.command_id),
    last_run: lastRun,
    running: !!runningRun,
    running_group_run_id: runningRun?.id,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  const body = await request.json();
  const result = updateGroup(id, body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  const result = deleteGroup(id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 404 }
    );
  }
  return NextResponse.json(result.data);
}
