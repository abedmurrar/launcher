import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { spawnCommand, getRunIdForCommand } from "@/lib/process-manager";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const commandId = Number((await params).id);
  if (Number.isNaN(commandId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = getDb();
  const cmd = db.prepare("SELECT id, name, command, cwd, env FROM commands WHERE id = ?").get(commandId) as {
    id: number;
    name: string;
    command: string;
    cwd: string;
    env: string;
  } | undefined;
  if (!cmd) {
    return NextResponse.json({ error: "Command not found" }, { status: 404 });
  }
  const existingRunId = getRunIdForCommand(commandId);
  if (existingRunId !== null) {
    return NextResponse.json(
      { error: "Command is already running", run_id: existingRunId },
      { status: 409 }
    );
  }
  const env = typeof cmd.env === "string" ? (JSON.parse(cmd.env || "{}") as Record<string, string>) : {};
  const runResult = db
    .prepare("INSERT INTO runs (command_id, status) VALUES (?, 'running')")
    .run(commandId);
  const runId = runResult.lastInsertRowid as number;
  const pid = spawnCommand(runId, commandId, cmd.command, cmd.cwd, env, null);
  return NextResponse.json({ run_id: runId, pid });
}
