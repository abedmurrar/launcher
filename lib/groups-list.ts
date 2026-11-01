import {
  listGroupsForList,
  listAllGroupCommands,
  listLastGroupRuns,
  listRunningGroupRuns,
} from "@/lib/db/queries";

export interface GroupListItem {
  id: number;
  name: string;
  created_at: string;
  command_ids: number[];
  last_run?:
    | { id: number; started_at: string; finished_at: string | null; status: string }
    | undefined;
  running: boolean;
  running_group_run_id?: number;
}

export async function buildGroupsList(): Promise<GroupListItem[]> {
  const [groups, members, lastRuns, running] = await Promise.all([
    listGroupsForList(),
    listAllGroupCommands(),
    listLastGroupRuns(),
    listRunningGroupRuns(),
  ]);

  const membersByGroup = new Map<number, number[]>();
  for (const m of members) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push(m.command_id);
    membersByGroup.set(m.group_id, list);
  }
  const lastRunByGroup = new Map(lastRuns.map((r) => [r.group_id, r]));
  const runningByGroup = new Map(running.map((r) => [r.group_id, r.id]));

  const list: GroupListItem[] = groups.map((g) => {
    const lastRun = lastRunByGroup.get(g.id);
    const runningRunId = runningByGroup.get(g.id);
    return {
      id: g.id,
      name: g.name,
      created_at: g.created_at,
      command_ids: membersByGroup.get(g.id) ?? [],
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

  // Most recently run first; never-run groups last
  list.sort((a, b) => {
    const aAt = a.last_run?.started_at ?? "";
    const bAt = b.last_run?.started_at ?? "";
    if (!aAt && !bAt) return 0;
    if (!aAt) return 1;
    if (!bAt) return -1;
    return bAt.localeCompare(aAt);
  });
  return list;
}
