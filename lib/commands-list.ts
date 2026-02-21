import { listCommandsForList, getPidByRunId, getLastRunByCommandId } from "@/lib/db/queries";
import { getRunIdForCommand } from "@/lib/process-manager";

export type CommandListItem = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  running: boolean;
  run_id?: number;
  last_run_id?: number;
  pid?: number;
};

export function buildCommandsList(): CommandListItem[] {
  const commands = listCommandsForList();

  return commands.map((c) => {
    const runId = getRunIdForCommand(c.id);
    const pid = runId != null ? getPidByRunId(runId) ?? null : null;
    const lastRun = getLastRunByCommandId(c.id);
    return {
      id: c.id,
      name: c.name,
      command: c.command,
      cwd: c.cwd,
      env: typeof c.env === "string" ? (JSON.parse(c.env || "{}") as Record<string, string>) : c.env,
      created_at: c.created_at,
      updated_at: c.updated_at,
      last_run_at: c.last_run_at,
      last_exit_code: c.last_exit_code,
      running: runId !== null,
      run_id: runId ?? undefined,
      last_run_id: lastRun?.id,
      pid: pid ?? undefined,
    };
  });
}
