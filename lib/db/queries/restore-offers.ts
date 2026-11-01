import { getDb } from "../connection";

export interface RestoreOfferRow {
  id: number;
  command_id: number | null;
  group_id: number | null;
  reason: string;
  created_at: string;
  name: string;
  auto_restart: number;
}

/** Offer a command or group for restore (one offer per target; the latest reason wins). */
export async function addRestoreOffer(target: { commandId?: number; groupId?: number }, reason: string): Promise<void> {
  const db = await getDb();
  const column = target.commandId != null ? "command_id" : "group_id";
  const id = target.commandId ?? target.groupId;
  await db.raw(
    `INSERT INTO restore_offers (${column}, reason) VALUES (?, ?)
     ON CONFLICT(${column}) WHERE ${column} IS NOT NULL
     DO UPDATE SET reason = excluded.reason, created_at = datetime('now')`,
    [id, reason]
  );
}

export async function listRestoreOffers(): Promise<RestoreOfferRow[]> {
  const db = await getDb();
  return (await db.raw(
    `SELECT o.id, o.command_id, o.group_id, o.reason, o.created_at,
            COALESCE(c.name, g.name) AS name, COALESCE(c.auto_restart, 0) AS auto_restart
     FROM restore_offers o
     LEFT JOIN commands c ON c.id = o.command_id
     LEFT JOIN groups g ON g.id = o.group_id
     ORDER BY name`
  )) as RestoreOfferRow[];
}

export async function deleteRestoreOffer(id: number): Promise<void> {
  const db = await getDb();
  await db("restore_offers").where("id", id).del();
}

export async function clearRestoreOffers(): Promise<void> {
  const db = await getDb();
  await db("restore_offers").del();
}

export async function getGroupIdByGroupRunId(groupRunId: number): Promise<number | null> {
  const db = await getDb();
  const row = await db("group_runs").select("group_id").where("id", groupRunId).first();
  return row?.group_id ?? null;
}

/** Durations (seconds) and reasons of the latest runs of a command, newest first. */
export async function getRecentRunDurations(
  commandId: number,
  limit: number
): Promise<{ seconds: number | null; end_reason: string | null }[]> {
  const db = await getDb();
  return (await db.raw(
    `SELECT CAST((julianday(finished_at) - julianday(started_at)) * 86400 AS INTEGER) AS seconds, end_reason
     FROM runs WHERE command_id = ? AND status != 'running' ORDER BY id DESC LIMIT ?`,
    [commandId, limit]
  )) as { seconds: number | null; end_reason: string | null }[];
}
