import { getDb } from "../connection";

const db = () => getDb();

export function insertLogChunk(
  runId: number,
  streamType: "stdout" | "stderr",
  content: string
): void {
  db()
    .prepare(
      "INSERT INTO log_chunks (run_id, stream_type, content, created_at) VALUES (?, ?, ?, datetime('now'))"
    )
    .run(runId, streamType, content);
}

export type LogChunkContentRow = { stream_type: string; content: string };

export function getLogChunksByRunId(runId: number): LogChunkContentRow[] {
  return db()
    .prepare(
      "SELECT stream_type, content FROM log_chunks WHERE run_id = ? ORDER BY id ASC"
    )
    .all(runId) as LogChunkContentRow[];
}

export type LogChunkFullRow = {
  id: number;
  run_id: number;
  stream_type: string;
  content: string;
  created_at: string;
};

export function getLogChunksFullByRunId(runId: number): LogChunkFullRow[] {
  return db()
    .prepare(
      "SELECT id, run_id, stream_type, content, created_at FROM log_chunks WHERE run_id = ? ORDER BY id ASC"
    )
    .all(runId) as LogChunkFullRow[];
}
