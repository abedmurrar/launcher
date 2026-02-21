import {
  getCommandByIdForRun,
  insertRun,
  updateRunStatusFailed,
  commandExists,
  getRunCommandId,
  insertCommand,
  getCommandById,
  updateCommandName,
  updateCommandCommand,
  updateCommandCwd,
  updateCommandEnv,
  deleteCommandById,
} from "@/lib/db/queries";
import {
  spawnCommand,
  getRunIdForCommand,
  stopRun,
  stopByCommandId,
  stopByCommandIdAndWait,
} from "@/lib/process-manager";
import { broadcastCommands } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import { createCommandSchema, updateCommandSchema } from "./types";
import { formatValidationError, parseEnv, invalidId, notFound } from "./helpers";
import { ActionResultFactory } from "./result-factory";

export function runCommand(
  commandId: number
): ActionResult<{ run_id: number; pid: number }> {
  if (Number.isNaN(commandId)) return invalidId();

  const cmd = getCommandByIdForRun(commandId);
  if (!cmd) return notFound("Command");

  const existingRunId = getRunIdForCommand(commandId);
  if (existingRunId !== null) {
    return ActionResultFactory.error("Command is already running", 409);
  }

  const env = parseEnv(cmd.env);
  const runId = insertRun(commandId);

  try {
    const pid = spawnCommand(runId, commandId, cmd.command, cmd.cwd, env, null);
    return ActionResultFactory.success({ run_id: runId, pid });
  } catch (err) {
    updateRunStatusFailed(runId);
    broadcastCommands();
    const message = err instanceof Error ? err.message : "Failed to start process";
    return ActionResultFactory.error(message);
  }
}

export function stopCommand(
  commandId: number,
  runId?: number
): ActionResult<{ ok: true }> {
  if (Number.isNaN(commandId)) return invalidId();

  let stopped: boolean;

  if (runId != null) {
    if (Number.isNaN(runId)) return ActionResultFactory.error("Invalid runId", 400);
    const run = getRunCommandId(runId);
    if (!run || run.command_id !== commandId) {
      return ActionResultFactory.error("Run not found or does not belong to this command", 404);
    }
    stopped = stopRun(runId);
  } else {
    stopped = stopByCommandId(commandId);
  }

  if (!stopped) {
    return ActionResultFactory.error("No running process found for this command", 404);
  }
  return ActionResultFactory.success({ ok: true as const });
}

export async function restartCommand(
  commandId: number
): Promise<ActionResult<{ run_id: number; pid: number }>> {
  if (Number.isNaN(commandId)) return invalidId();

  const cmd = getCommandByIdForRun(commandId);
  if (!cmd) return notFound("Command");

  await stopByCommandIdAndWait(commandId);
  const env = parseEnv(cmd.env);
  const runId = insertRun(commandId);
  const pid = spawnCommand(runId, commandId, cmd.command, cmd.cwd, env, null);

  return ActionResultFactory.success({ run_id: runId, pid });
}

export function createCommand(
  body: unknown
): ActionResult<Record<string, unknown>> {
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  const { name, command, cwd, env } = parsed.data;
  const id = insertCommand(name, command, cwd, JSON.stringify(env));
  const row = getCommandById(id)!;

  broadcastCommands();
  return ActionResultFactory.success({
    id: row.id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    env: typeof row.env === "string" ? JSON.parse(row.env) : row.env,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at,
    last_exit_code: row.last_exit_code,
  });
}

export function updateCommand(
  id: number,
  body: unknown
): ActionResult<Record<string, unknown>> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = updateCommandSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  if (!commandExists(id)) return notFound("Command");

  const { name, command, cwd, env } = parsed.data;
  if (name !== undefined) updateCommandName(name, id);
  if (command !== undefined) updateCommandCommand(command, id);
  if (cwd !== undefined) updateCommandCwd(cwd, id);
  if (env !== undefined) updateCommandEnv(JSON.stringify(env), id);

  broadcastCommands();
  const row = getCommandById(id)!;
  return ActionResultFactory.success({
    id: row.id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    env: typeof row.env === "string" ? JSON.parse(row.env as string) : row.env,
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at,
    last_exit_code: row.last_exit_code,
  });
}

export function deleteCommand(id: number): ActionResult<{ ok: true }> {
  if (Number.isNaN(id)) return invalidId();

  const changes = deleteCommandById(id);
  if (changes === 0) return notFound("Command");

  broadcastCommands();
  return ActionResultFactory.success({ ok: true as const });
}
