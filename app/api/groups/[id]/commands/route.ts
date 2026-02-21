import { NextRequest, NextResponse } from "next/server";
import { groupExists, getGroupCommandsByGroupId } from "@/lib/db/queries";
import { setGroupCommands } from "@/lib/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!groupExists(id)) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const rows = getGroupCommandsByGroupId(id);
  return NextResponse.json({ command_ids: rows.map((r) => r.command_id) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  const body = await request.json();
  const result = setGroupCommands(id, body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 400 }
    );
  }
  return NextResponse.json(result.data);
}
