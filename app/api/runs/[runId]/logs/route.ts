import { NextRequest, NextResponse } from "next/server";
import { runExists, getLogChunksFullByRunId, deleteLogChunksByRunId } from "@/lib/db/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const runId = Number((await params).runId);
  if (Number.isNaN(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }
  if (!runExists(runId)) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const chunks = getLogChunksFullByRunId(runId);
  return NextResponse.json({ run_id: runId, chunks });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const runId = Number((await params).runId);
  if (Number.isNaN(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }
  if (!runExists(runId)) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  deleteLogChunksByRunId(runId);
  return NextResponse.json({ run_id: runId, cleared: true });
}
