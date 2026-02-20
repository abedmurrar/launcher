import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const runId = Number((await params).runId);
  if (Number.isNaN(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }
  const db = getDb();
  const run = db.prepare("SELECT id FROM runs WHERE id = ?").get(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const chunks = db
    .prepare(
      "SELECT id, run_id, stream_type, content, created_at FROM log_chunks WHERE run_id = ? ORDER BY id ASC"
    )
    .all(runId) as Array<{ id: number; run_id: number; stream_type: string; content: string; created_at: string }>;
  return NextResponse.json({ run_id: runId, chunks });
}
