import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { stopRun, stopByCommandId } from "@/lib/process-manager";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const commandId = Number((await params).id);
  if (Number.isNaN(commandId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const { searchParams } = new URL(request.url);
  const runIdParam = searchParams.get("runId");
  let stopped: boolean;
  if (runIdParam != null) {
    const runId = Number(runIdParam);
    if (Number.isNaN(runId)) {
      return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
    }
    const db = getDb();
    const run = db.prepare("SELECT command_id FROM runs WHERE id = ?").get(runId) as { command_id: number } | undefined;
    if (!run || run.command_id !== commandId) {
      return NextResponse.json({ error: "Run not found or does not belong to this command" }, { status: 404 });
    }
    stopped = stopRun(runId);
  } else {
    stopped = stopByCommandId(commandId);
  }
  if (!stopped) {
    return NextResponse.json({ error: "No running process found for this command" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
