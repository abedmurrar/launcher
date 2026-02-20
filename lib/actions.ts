import { getDb } from "@/lib/db";
import {
  spawnCommand,
  getRunIdForCommand,
  stopRun,
  stopByCommandId,
  stopByCommandIdAndWait,
} from "@/lib/process-manager";
import { broadcastCommands, broadcastGroups } from "@/lib/ws-broadcast";
import { z } from "zod";

type OkResult<T = void> = { success: true; data?: T };
type ErrResult = { success: false; error: string; code?: number };
type ActionResult<T = void> = OkResult<T> | ErrResult;

const createCommandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().default(""),
  env: z.record(z.string(), z.string()).default({}),
});

const updateCommandSchema = z.object({
  name: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const createGroupSchema = z.object({ name: z.string().min(1) });
const updateGroupSchema = z.object({ name: z.string().min(1) });
const setGroupCommandsSchema = z.object({ commandIds: z.array(z.number()) });

export function runCommand(commandId: number): ActionResult<{ run_id: number; pid: number }> {
  if (Number.isNaN(commandId)) return { success: false, error: "Invalid id", code: 400 };
  const db = getDb();
  const cmd = db.prepare("SELECT id, name, command, cwd, env FROM commands WHERE id = ?").get(commandId) as {
    id: number;
    command: string;
    cwd: string;
    env: string;
  } | undefined;
  if (!cmd) return { success: false, error: "Command not found", code: 404 };
  const existingRunId = getRunIdForCommand(commandId);
  if (existingRunId !== null) {
    return { success: false, error: "Command is already running", code: 409 };
  }
  const env = typeof cmd.env === "string" ? (JSON.parse(cmd.env || "{}") as Record<string, string>) : {};
  const runResult = db.prepare("INSERT INTO runs (command_id, status) VALUES (?, 'running')").run(commandId);
  const runId = runResult.lastInsertRowid as number;
  const pid = spawnCommand(runId, commandId, cmd.command, cmd.cwd, env, null);
  return { success: true, data: { run_id: runId, pid } };
}

export function stopCommand(commandId: number, runId?: number): ActionResult<{ ok: true }> {
  if (Number.isNaN(commandId)) return { success: false, error: "Invalid id", code: 400 };
  let stopped: boolean;
  if (runId != null) {
    if (Number.isNaN(runId)) return { success: false, error: "Invalid runId", code: 400 };
    const db = getDb();
    const run = db.prepare("SELECT command_id FROM runs WHERE id = ?").get(runId) as { command_id: number } | undefined;
    if (!run || run.command_id !== commandId) {
      return { success: false, error: "Run not found or does not belong to this command", code: 404 };
    }
    stopped = stopRun(runId);
  } else {
    stopped = stopByCommandId(commandId);
  }
  if (!stopped) return { success: false, error: "No running process found for this command", code: 404 };
  return { success: true, data: { ok: true } };
}

export async function restartCommand(commandId: number): Promise<ActionResult<{ run_id: number; pid: number }>> {
  if (Number.isNaN(commandId)) return { success: false, error: "Invalid id", code: 400 };
  const db = getDb();
  const cmd = db.prepare("SELECT id, name, command, cwd, env FROM commands WHERE id = ?").get(commandId) as {
    id: number;
    command: string;
    cwd: string;
    env: string;
  } | undefined;
  if (!cmd) return { success: false, error: "Command not found", code: 404 };
  await stopByCommandIdAndWait(commandId);
  const env = typeof cmd.env === "string" ? (JSON.parse(cmd.env || "{}") as Record<string, string>) : {};
  const runResult = db.prepare("INSERT INTO runs (command_id, status) VALUES (?, 'running')").run(commandId);
  const runId = runResult.lastInsertRowid as number;
  const pid = spawnCommand(runId, commandId, cmd.command, cmd.cwd, env, null);
  return { success: true, data: { run_id: runId, pid } };
}

export function createCommand(body: unknown): ActionResult<Record<string, unknown>> {
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    const err = parsed.error as { message?: string; issues?: Array<{ message?: string }> };
    const msg = err.issues?.map((e) => e.message).join("; ") ?? err.message ?? "Validation failed";
    return { success: false, error: msg, code: 400 };
  }
  const { name, command, cwd, env } = parsed.data;
  const db = getDb();
  const result = db
    .prepare("INSERT INTO commands (name, command, cwd, env) VALUES (?, ?, ?, ?)")
    .run(name, command, cwd, JSON.stringify(env));
  const id = result.lastInsertRowid as number;
  const row = db.prepare("SELECT * FROM commands WHERE id = ?").get(id) as Record<string, unknown>;
  broadcastCommands();
  return {
    success: true,
    data: {
      id,
      name: row.name,
      command: row.command,
      cwd: row.cwd,
      env: typeof row.env === "string" ? JSON.parse(row.env as string) : row.env,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_run_at: row.last_run_at,
      last_exit_code: row.last_exit_code,
    },
  };
}

export function updateCommand(id: number, body: unknown): ActionResult<Record<string, unknown>> {
  if (Number.isNaN(id)) return { success: false, error: "Invalid id", code: 400 };
  const parsed = updateCommandSchema.safeParse(body);
  if (!parsed.success) return { success: false, error: String(parsed.error.flatten()) };
  const db = getDb();
  const existing = db.prepare("SELECT id FROM commands WHERE id = ?").get(id);
  if (!existing) return { success: false, error: "Command not found", code: 404 };
  const { name, command, cwd, env } = parsed.data;
  if (name !== undefined) db.prepare("UPDATE commands SET name = ?, updated_at = datetime('now') WHERE id = ?").run(name, id);
  if (command !== undefined) db.prepare("UPDATE commands SET command = ?, updated_at = datetime('now') WHERE id = ?").run(command, id);
  if (cwd !== undefined) db.prepare("UPDATE commands SET cwd = ?, updated_at = datetime('now') WHERE id = ?").run(cwd, id);
  if (env !== undefined) db.prepare("UPDATE commands SET env = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(env), id);
  broadcastCommands();
  const row = db.prepare("SELECT * FROM commands WHERE id = ?").get(id) as Record<string, unknown>;
  return {
    success: true,
    data: {
      id: row.id,
      name: row.name,
      command: row.command,
      cwd: row.cwd,
      env: typeof row.env === "string" ? JSON.parse(row.env as string) : row.env,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_run_at: row.last_run_at,
      last_exit_code: row.last_exit_code,
    },
  };
}

export function deleteCommand(id: number): ActionResult<{ ok: true }> {
  if (Number.isNaN(id)) return { success: false, error: "Invalid id", code: 400 };
  const db = getDb();
  const result = db.prepare("DELETE FROM commands WHERE id = ?").run(id);
  if (result.changes === 0) return { success: false, error: "Command not found", code: 404 };
  broadcastCommands();
  return { success: true, data: { ok: true } };
}

export function createGroup(body: unknown): ActionResult<Record<string, unknown>> {
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) return { success: false, error: String(parsed.error.flatten()) };
  const db = getDb();
  const result = db.prepare("INSERT INTO groups (name) VALUES (?)").run(parsed.data.name);
  const id = result.lastInsertRowid as number;
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Record<string, unknown>;
  broadcastGroups();
  return { success: true, data: row };
}

export function updateGroup(id: number, body: unknown): ActionResult<Record<string, unknown>> {
  if (Number.isNaN(id)) return { success: false, error: "Invalid id", code: 400 };
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) return { success: false, error: String(parsed.error.flatten()) };
  const db = getDb();
  const existing = db.prepare("SELECT id FROM groups WHERE id = ?").get(id);
  if (!existing) return { success: false, error: "Group not found", code: 404 };
  db.prepare("UPDATE groups SET name = ? WHERE id = ?").run(parsed.data.name, id);
  broadcastGroups();
  const row = db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as Record<string, unknown>;
  return { success: true, data: row };
}

export function deleteGroup(id: number): ActionResult<{ ok: true }> {
  if (Number.isNaN(id)) return { success: false, error: "Invalid id", code: 400 };
  const db = getDb();
  const result = db.prepare("DELETE FROM groups WHERE id = ?").run(id);
  if (result.changes === 0) return { success: false, error: "Group not found", code: 404 };
  broadcastGroups();
  return { success: true, data: { ok: true } };
}

export function setGroupCommands(id: number, body: unknown): ActionResult<{ command_ids: number[] }> {
  if (Number.isNaN(id)) return { success: false, error: "Invalid id", code: 400 };
  const parsed = setGroupCommandsSchema.safeParse(body);
  if (!parsed.success) return { success: false, error: String(parsed.error.flatten()) };
  const db = getDb();
  const group = db.prepare("SELECT id FROM groups WHERE id = ?").get(id);
  if (!group) return { success: false, error: "Group not found", code: 404 };
  db.prepare("DELETE FROM group_commands WHERE group_id = ?").run(id);
  const commandIds = parsed.data.commandIds;
  const insert = db.prepare(
    "INSERT INTO group_commands (group_id, command_id, sort_order) VALUES (?, ?, ?)"
  );
  commandIds.forEach((commandId, index) => {
    insert.run(id, commandId, index);
  });
  const rows = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(id) as Array<{ command_id: number; sort_order: number }>;
  broadcastGroups();
  return { success: true, data: { command_ids: rows.map((r) => r.command_id) } };
}

export function runGroup(groupId: number): ActionResult<{ group_run_id: number; runs: Array<{ run_id: number; command_id: number; pid: number }> }> {
  if (Number.isNaN(groupId)) return { success: false, error: "Invalid id", code: 400 };
  const db = getDb();
  const group = db.prepare("SELECT id FROM groups WHERE id = ?").get(groupId);
  if (!group) return { success: false, error: "Group not found", code: 404 };
  const runningRun = db
    .prepare("SELECT id FROM group_runs WHERE group_id = ? AND status = 'running' LIMIT 1")
    .get(groupId) as { id: number } | undefined;
  if (runningRun) return { success: false, error: "Group is already running", code: 409 };
  const members = db
    .prepare(
      "SELECT command_id, sort_order FROM group_commands WHERE group_id = ? ORDER BY sort_order ASC"
    )
    .all(groupId) as Array<{ command_id: number; sort_order: number }>;
  if (members.length === 0) return { success: false, error: "Group has no commands", code: 400 };
  const groupRunResult = db.prepare("INSERT INTO group_runs (group_id, status) VALUES (?, 'running')").run(groupId);
  const groupRunId = groupRunResult.lastInsertRowid as number;
  const runs: { run_id: number; command_id: number; pid: number }[] = [];
  for (const m of members) {
    const existingRunId = getRunIdForCommand(m.command_id);
    if (existingRunId !== null) {
      db.prepare("UPDATE group_runs SET status = 'failed', finished_at = datetime('now') WHERE id = ?").run(groupRunId);
      return { success: false, error: "One or more commands are already running", code: 409 };
    }
    const cmd = db.prepare("SELECT id, command, cwd, env FROM commands WHERE id = ?").get(m.command_id) as {
      id: number;
      command: string;
      cwd: string;
      env: string;
    };
    if (!cmd) continue;
    const env = typeof cmd.env === "string" ? (JSON.parse(cmd.env || "{}") as Record<string, string>) : {};
    const runResult = db
      .prepare("INSERT INTO runs (command_id, group_run_id, status) VALUES (?, ?, 'running')")
      .run(m.command_id, groupRunId);
    const runId = runResult.lastInsertRowid as number;
    const pid = spawnCommand(runId, m.command_id, cmd.command, cmd.cwd, env, groupRunId);
    runs.push({ run_id: runId, command_id: m.command_id, pid });
  }
  return { success: true, data: { group_run_id: groupRunId, runs } };
}
