import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { registerSSEWriter, isRunLive } from "@/lib/process-manager";

function sseMessage(data: string, event?: string): string {
  const lines = event ? [`event: ${event}`, `data: ${data}`, ""] : [`data: ${data}`, ""];
  return lines.join("\n");
}

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

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: string, streamType: "stdout" | "stderr") => {
    const payload = JSON.stringify({ streamType, data });
    writer.write(encoder.encode(sseMessage(payload)));
  };

  (async () => {
    const existing = db
      .prepare(
        "SELECT stream_type, content FROM log_chunks WHERE run_id = ? ORDER BY id ASC"
      )
      .all(runId) as Array<{ stream_type: string; content: string }>;
    for (const row of existing) {
      send(row.content, row.stream_type as "stdout" | "stderr");
    }
    if (isRunLive(runId)) {
      const unregister = registerSSEWriter(runId, (content, streamType) => {
        if (content === "[run finished]") {
          writer.write(encoder.encode(sseMessage(JSON.stringify({ event: "finished" }), "finished")));
          unregister();
          writer.close();
        } else {
          send(content, streamType);
        }
      });
    } else {
      writer.write(encoder.encode(sseMessage(JSON.stringify({ event: "finished" }), "finished")));
      writer.close();
    }
  })();

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
