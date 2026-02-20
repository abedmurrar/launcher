import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";

const putSchema = z.object({
  commandIds: z.array(z.coerce.number()),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = getDb();
  const group = db.prepare("SELECT id FROM groups WHERE id = ?").get(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const rows = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(id) as Array<{ command_id: number; sort_order: number }>;
  return NextResponse.json({ command_ids: rows.map((r) => r.command_id) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await request.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const db = getDb();
  const group = db.prepare("SELECT id FROM groups WHERE id = ?").get(id);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  db.prepare("DELETE FROM group_commands WHERE group_id = ?").run(id);
  const commandIds = parsed.data.commandIds;
  const insert = db.prepare(
    "INSERT INTO group_commands (group_id, command_id, sort_order) VALUES (?, ?, ?)"
  );
  commandIds.forEach((commandId, index) => {
    insert.run(id, commandId, index);
  });
  const rows = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(id) as Array<{ command_id: number; sort_order: number }>;
  return NextResponse.json({ command_ids: rows.map((r) => r.command_id) });
}
