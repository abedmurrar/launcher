import { NextRequest, NextResponse } from "next/server";
import {
  getGroupById,
  getGroupCommandsByGroupId,
  getLastGroupRunByGroupId,
  getRunningGroupRunIdByGroupId,
} from "@/lib/db/queries";
import { updateGroup, deleteGroup } from "@/lib/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const row = getGroupById(id) as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const commands = getGroupCommandsByGroupId(id);
  const lastRun = getLastGroupRunByGroupId(id);
  const runningRunId = getRunningGroupRunIdByGroupId(id);

  return NextResponse.json({
    ...row,
    command_ids: commands.map((c) => c.command_id),
    last_run: lastRun ?? undefined,
    running: runningRunId !== undefined,
    running_group_run_id: runningRunId,
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
