import { listCommandsForList } from "@/lib/db/queries";
import { getGitBranch } from "@/lib/git-branch";
import { parseEnv } from "@/lib/actions/helpers";

export interface CommandListItem {
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
  /** Status of the most recent run: running | success | failed | killed */
  last_run_status?: string;
  /** Why the most recent run ended (see EndReason). */
  last_end_reason?: string;
  pid?: number;
  /** Git branch at cwd, if the directory is a git repo */
  git_branch?: string | null;
}

export async function buildCommandsList(): Promise<CommandListItem[]> {
  const rows = await listCommandsForList();
  const branches = await Promise.all(rows.map((c) => (c.cwd ? getGitBranch(c.cwd) : null)));

  return rows.map((c, i) => ({
    id: c.id,
    name: c.name,
    command: c.command,
    cwd: c.cwd,
    env: parseEnv(c.env),
    created_at: c.created_at,
    updated_at: c.updated_at,
    last_run_at: c.last_run_at,
    last_exit_code: c.last_exit_code,
    running: c.run_id != null,
    run_id: c.run_id ?? undefined,
    last_run_id: c.last_run_id ?? undefined,
    last_run_status: c.last_run_status ?? undefined,
    last_end_reason: c.last_end_reason ?? undefined,
    pid: c.run_pid ?? undefined,
    git_branch: branches[i] ?? undefined,
  }));
}
