import { getDb } from "@/lib/db";

export type GroupListItem = {
  id: number;
  name: string;
  created_at: string;
  command_ids: number[];
  last_run?:
    | { id: number; started_at: string; finished_at: string | null; status: string }
    | undefined;
  running: boolean;
  running_group_run_id?: number;
};

export function buildGroupsList(): GroupListItem[] {
  const db = getDb();
  const groups = db
    .prepare(
      `SELECT g.id, g.name, g.created_at
       FROM groups g
       ORDER BY g.name ASC`
    )
    .all() as Array<{ id: number; name: string; created_at: string }>;

  return groups.map((g) => {
    const commands = db
      .prepare(
        "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
      )
      .all(g.id) as Array<{ command_id: number; sort_order: number }>;
    const lastRun = db
      .prepare(
        "SELECT id, started_at, finished_at, status FROM group_runs WHERE group_id = ? ORDER BY started_at DESC LIMIT 1"
      )
      .get(g.id) as { id: number; started_at: string; finished_at: string | null; status: string } | undefined;
    const runningRun = db
      .prepare(
        "SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1"
      )
      .get(g.id) as { id: number } | undefined;
    return {
      id: g.id,
      name: g.name,
      created_at: g.created_at,
      command_ids: commands.map((c) => c.command_id),
      last_run: lastRun
        ? {
            id: lastRun.id,
            started_at: lastRun.started_at,
            finished_at: lastRun.finished_at,
            status: lastRun.status,
          }
        : undefined,
      running: !!runningRun,
      running_group_run_id: runningRun?.id,
    };
  });
}
