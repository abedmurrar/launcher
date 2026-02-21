import {
  listGroupsForList,
  getGroupCommandsByGroupId,
  getLastGroupRunByGroupId,
  getRunningGroupRunIdByGroupId,
} from "@/lib/db/queries";

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
  const groups = listGroupsForList();

  return groups.map((g) => {
    const commands = getGroupCommandsByGroupId(g.id);
    const lastRun = getLastGroupRunByGroupId(g.id);
    const runningRunId = getRunningGroupRunIdByGroupId(g.id);
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
      running: runningRunId !== undefined,
      running_group_run_id: runningRunId,
    };
  });
}
