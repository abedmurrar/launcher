import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { spawnCommand, getRunIdForCommand } from "@/lib/process-manager";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const groupId = Number((await params).id);
  if (Number.isNaN(groupId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const db = getDb();
  const group = db.prepare("SELECT id FROM groups WHERE id = ?").get(groupId);
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const runningRun = db
    .prepare("SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1")
    .get(groupId) as { id: number } | undefined;
  if (runningRun) {
    return NextResponse.json(
      { error: "Group is already running", group_run_id: runningRun.id },
      { status: 409 }
    );
  }

  const members = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(groupId) as Array<{ command_id: number; sort_order: number }>;
  if (members.length === 0) {
    return NextResponse.json({ error: "Group has no commands" }, { status: 400 });
  }

  const groupRunResult = db
    .prepare("INSERT INTO group_runs (group_id, status) VALUES (?, 'running')")
    .run(groupId);
  const groupRunId = groupRunResult.lastInsertRowid as number;

  const runs: { run_id: number; command_id: number; pid: number }[] = [];
  for (const m of members) {
    const existingRunId = getRunIdForCommand(m.command_id);
    if (existingRunId !== null) {
      db.prepare("UPDATE group_runs SET status = 'failed', finished_at = datetime('now') WHERE id = ?").run(groupRunId);
      return NextResponse.json(
        { error: "One or more commands are already running", command_id: m.command_id },
        { status: 409 }
      );
    }
    const cmd = db.prepare("SELECT id, command, cwd, env FROM commands WHERE id = ?").get(m.command_id) as {
      id: number;
      command: string;
      cwd: string;
      env: string;
    };
    if (!cmd) continue;
    const env = typeof cmd.env === "string" ? (JSON.parse(cmd.env || "{}") as Record<string, string>) : {};
    const runResult = db
      .prepare("INSERT INTO runs (command_id, group_run_id, status) VALUES (?, ?, 'running')")
      .run(m.command_id, groupRunId);
    const runId = runResult.lastInsertRowid as number;
    const pid = spawnCommand(runId, m.command_id, cmd.command, cmd.cwd, env, groupRunId);
    runs.push({ run_id: runId, command_id: m.command_id, pid });
  }

  return NextResponse.json({
    group_run_id: groupRunId,
    runs,
  });
}
