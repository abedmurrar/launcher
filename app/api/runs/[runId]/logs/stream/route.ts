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
    try {
      const payload = JSON.stringify({ streamType, data });
      writer.write(encoder.encode(sseMessage(payload)));
    } catch {
      // Stream already closed (e.g. client disconnected)
    }
  };

  const safeWriteAndClose = (message: Uint8Array, thenClose: boolean) => {
    try {
      writer.write(message);
      if (thenClose) writer.close();
    } catch {
      // Stream already closed (e.g. client disconnected or stop aborted response)
    }
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
          unregister();
          safeWriteAndClose(
            encoder.encode(sseMessage(JSON.stringify({ event: "finished" }), "finished")),
            true
          );
        } else {
          send(content, streamType);
        }
      });
    } else {
      safeWriteAndClose(
        encoder.encode(sseMessage(JSON.stringify({ event: "finished" }), "finished")),
        true
      );
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
