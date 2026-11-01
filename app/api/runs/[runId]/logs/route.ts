import { NextRequest, NextResponse } from "next/server";
import { runExists, getLogChunksFullByRunId, deleteLogChunksByRunId } from "@/lib/db/queries";

/**
 * GET /api/runs/:runId/logs[?before=<chunkId>&limit=<n>][&format=text]
 * Without params returns every chunk; with `limit` returns the `limit` chunks before `before` (paging back).
 * `format=text` returns the output as plain text (for "open full log").
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const runId = Number((await params).runId);
  if (Number.isNaN(runId)) {
    return NextResponse.json({ error: "Invalid runId" }, { status: 400 });
  }
  if (!(await runExists(runId))) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const { searchParams } = new URL(request.url);
  const beforeParam = searchParams.get("before");
  const limitParam = searchParams.get("limit");
  const before = beforeParam != null ? Number(beforeParam) : undefined;
  const limit = limitParam != null ? Math.min(Math.max(1, Number(limitParam)), 10_000) : undefined;
  if ((before !== undefined && Number.isNaN(before)) || (limit !== undefined && Number.isNaN(limit))) {
    return NextResponse.json({ error: "Invalid before/limit" }, { status: 400 });
  }
  const chunks = await getLogChunksFullByRunId(runId, { before, limit });
  if (searchParams.get("format") === "text") {
    return new NextResponse(chunks.map((c) => c.content).join(""), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
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
  if (!(await runExists(runId))) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  await deleteLogChunksByRunId(runId);
  return NextResponse.json({ run_id: runId, cleared: true });
}
