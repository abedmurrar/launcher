import { getDb } from "../connection";

export interface LogChunkInsert {
  stream_type: "stdout" | "stderr";
  content: string;
}

const INSERT_SLICE = 200;

export interface RunLogOffsets {
  stdout: number;
  stderr: number;
}

/**
 * Insert a batch of chunks for a run in one transaction, optionally recording the log-file
 * offsets they were read up to (so file ingestion is exactly-once across restarts).
 * Returns the id of the last inserted row (ids within a batch are contiguous).
 */
export async function insertLogChunksBatch(
  runId: number,
  chunks: LogChunkInsert[],
  offsets?: RunLogOffsets
): Promise<number | undefined> {
  if (chunks.length === 0 && !offsets) return undefined;
  const db = await getDb();
  return db.transaction(async (trx) => {
    if (offsets) {
      await trx("runs")
        .where("id", runId)
        .update({ stdout_offset: offsets.stdout, stderr_offset: offsets.stderr });
    }
    let lastId: number | undefined;
    for (let i = 0; i < chunks.length; i += INSERT_SLICE) {
      const rows = chunks.slice(i, i + INSERT_SLICE).map((c) => ({
        run_id: runId,
        stream_type: c.stream_type,
        content: c.content,
      }));
      const [id] = await trx("log_chunks").insert(rows);
      lastId = id;
    }
    return lastId;
  });
}

export interface LogChunkContentRow {
  id: number;
  stream_type: string;
  content: string;
}

export interface LogTail {
  chunks: LogChunkContentRow[];
  /** True when older chunks exist that were not included. */
  truncated: boolean;
  /** Id of the newest chunk included (0 if none). */
  lastId: number;
}

/** The newest chunks of a run whose combined size is about `maxBytes`, oldest first. */
export async function getLogTailByRunId(runId: number, maxBytes: number): Promise<LogTail> {
  const db = await getDb();
  const chunks = (await db.raw(
    `SELECT id, stream_type, content FROM (
       SELECT id, stream_type, content,
              SUM(length(content)) OVER (ORDER BY id DESC) AS cum
       FROM log_chunks WHERE run_id = ?
     )
     WHERE cum - length(content) < ?
     ORDER BY id ASC`,
    [runId, maxBytes]
  )) as LogChunkContentRow[];

  if (chunks.length === 0) return { chunks, truncated: false, lastId: 0 };

  const older = await db("log_chunks")
    .select("id")
    .where("run_id", runId)
    .andWhere("id", "<", chunks[0].id)
    .first();
  return { chunks, truncated: older != null, lastId: chunks[chunks.length - 1].id };
}

export interface LogChunkFullRow {
  id: number;
  run_id: number;
  stream_type: string;
  content: string;
  created_at: string;
}

/**
 * Full chunks for a run, oldest first. With `before`/`limit`, returns the `limit`
 * chunks immediately preceding id `before` (for paging backwards through history).
 */
export async function getLogChunksFullByRunId(
  runId: number,
  opts: { before?: number; limit?: number } = {}
): Promise<LogChunkFullRow[]> {
  const db = await getDb();
  const query = db("log_chunks")
    .select("id", "run_id", "stream_type", "content", "created_at")
    .where("run_id", runId);
  if (opts.before != null) query.andWhere("id", "<", opts.before);
  if (opts.limit != null) {
    const rows = (await query.orderBy("id", "desc").limit(opts.limit)) as LogChunkFullRow[];
    return rows.reverse();
  }
  return (await query.orderBy("id", "asc")) as LogChunkFullRow[];
}

export async function deleteLogChunksByRunId(runId: number): Promise<void> {
  const db = await getDb();
  await db("log_chunks").where("run_id", runId).del();
}

/**
 * Retention: delete log chunks of finished runs beyond the newest `retainRunsPerCommand`
 * runs of each command, or older than `retainDays` (0 disables the age limit).
 * The most recent run of every command is always kept, however old.
 * With `maxRunBytes` > 0, every run's stored log is also capped to its newest `maxRunBytes`.
 * Returns the number of chunks deleted.
 */
export async function pruneLogChunks(
  retainRunsPerCommand: number,
  retainDays: number,
  maxRunBytes = 0
): Promise<number> {
  const db = await getDb();
  const keep = Math.max(1, retainRunsPerCommand);
  const deleted = await db.raw(
    `DELETE FROM log_chunks WHERE run_id IN (
       SELECT id FROM (
         SELECT id, status, started_at,
                ROW_NUMBER() OVER (PARTITION BY command_id ORDER BY id DESC) AS rn
         FROM runs
       )
       WHERE status != 'running'
         AND rn > 1
         AND (rn > ? OR (? > 0 AND started_at < datetime('now', '-' || ? || ' days')))
     )`,
    [keep, retainDays, retainDays]
  );
  let changes = (deleted as { changes?: number } | undefined)?.changes ?? 0;
  if (maxRunBytes > 0) {
    // Per-run size cap (also applies to long-running runs): drop the oldest chunks beyond it.
    const trimmed = await db.raw(
      `DELETE FROM log_chunks WHERE id IN (
         SELECT id FROM (
           SELECT id, SUM(length(content)) OVER (PARTITION BY run_id ORDER BY id DESC) AS cum
           FROM log_chunks
         ) WHERE cum > ?
       )`,
      [maxRunBytes]
    );
    changes += (trimmed as { changes?: number } | undefined)?.changes ?? 0;
  }
  if (changes > 0) {
    await db.raw("PRAGMA wal_checkpoint(TRUNCATE)");
  }
  return changes;
}
