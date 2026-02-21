import { NextRequest, NextResponse } from "next/server";
import { getCommandById, getRunByIdFull, getLastRunByCommandIdFull } from "@/lib/db/queries";
import { getRunIdForCommand } from "@/lib/process-manager";
import { updateCommand, deleteCommand } from "@/lib/actions";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const row = getCommandById(id) as Record<string, unknown> | undefined;
  if (!row) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }
  const runId = getRunIdForCommand(id);
  const runRow = runId != null ? getRunByIdFull(runId) : null;
  const lastRun = getLastRunByCommandIdFull(id);

  return NextResponse.json({
    id: row.id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    env: typeof row.env === "string" ? JSON.parse((row.env as string) || "{}") : row.env,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at,
    last_exit_code: row.last_exit_code,
    running: runId !== null,
    current_run_id: runId ?? undefined,
    current_run: runRow
      ? { id: runRow.id, pid: runRow.pid, started_at: runRow.started_at, status: runRow.status }
      : undefined,
    last_run: lastRun != null
      ? {
          id: lastRun.id,
          started_at: lastRun.started_at,
          finished_at: lastRun.finished_at,
          exit_code: lastRun.exit_code,
          status: lastRun.status,
        }
      : undefined,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  const body = await request.json();
  const result = updateCommand(id, body);
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
  const result = deleteCommand(id);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: (result.code as number) ?? 404 }
    );
  }
  return NextResponse.json(result.data);
}
