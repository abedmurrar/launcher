import { getDb } from "../connection";

export async function insertLogChunk(
  runId: number,
  streamType: "stdout" | "stderr",
  content: string
): Promise<void> {
  const db = await getDb();
  await db("log_chunks").insert({
    run_id: runId,
    stream_type: streamType,
    content,
    created_at: db.raw("datetime('now')"),
  });
}

export interface LogChunkContentRow {
  stream_type: string;
  content: string;
}

export async function getLogChunksByRunId(runId: number) {
  const db = await getDb();
  return db("log_chunks").select("stream_type", "content").where("run_id", runId).orderBy("id", "asc");
}

export interface LogChunkFullRow {
  id: number;
  run_id: number;
  stream_type: string;
  content: string;
  created_at: string;
}

export async function getLogChunksFullByRunId(runId: number) {
  const db = await getDb();
  return db("log_chunks")
    .select("id", "run_id", "stream_type", "content", "created_at")
    .where("run_id", runId)
    .orderBy("id", "asc");
}

export async function deleteLogChunksByRunId(runId: number): Promise<void> {
  const db = await getDb();
  await db("log_chunks").where("run_id", runId).del();
}
