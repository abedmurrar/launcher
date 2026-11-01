import {
  getCommandByIdForRun,
  insertRun,
  updateRunStatusFailed,
  commandExists,
  getRunCommandId,
  getRunningRunIdByCommandId,
  insertCommand,
  getCommandById,
  updateCommandFields,
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
import {
  formatValidationError,
  parseEnv,
  invalidId,
  notFound,
  withLock,
  isUniqueViolation,
} from "./helpers";
import { ActionResultFactory } from "./result-factory";

type CommandForRun = NonNullable<Awaited<ReturnType<typeof getCommandByIdForRun>>>;
type StartResult = ActionResult<{ run_id: number; pid: number }>;

const alreadyRunning = () => ActionResultFactory.error("Command is already running", 409);

/** Insert a run row and spawn the process. Caller must hold the command lock. */
async function startRun(cmd: CommandForRun): Promise<StartResult> {
  let runId: number;
  try {
    runId = await insertRun(cmd.id);
  } catch (err) {
    // Partial unique index: at most one running run per command.
    if (isUniqueViolation(err)) return alreadyRunning();
    throw err;
  }

  try {
    const pid = await spawnCommand(runId, cmd.id, cmd.command, cmd.cwd, parseEnv(cmd.env), null);
    return ActionResultFactory.success({ run_id: runId, pid });
  } catch (err) {
    await updateRunStatusFailed(runId);
    await broadcastCommands();
    const message = err instanceof Error ? err.message : "Failed to start process";
    return ActionResultFactory.error(message, 500);
  }
}

function serializeCommand(row: NonNullable<Awaited<ReturnType<typeof getCommandById>>>) {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    cwd: row.cwd,
    env: parseEnv(row.env),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_run_at: row.last_run_at,
    last_exit_code: row.last_exit_code,
    auto_restart: Boolean(row.auto_restart),
  };
}

export async function runCommand(commandId: number): Promise<StartResult> {
  if (Number.isNaN(commandId)) return invalidId();

  return withLock(`command:${commandId}`, async () => {
    const cmd = await getCommandByIdForRun(commandId);
    if (!cmd) return notFound("Command");
    if ((await getRunIdForCommand(commandId)) !== null) return alreadyRunning();
    return startRun(cmd);
  });
}

export async function stopCommand(
  commandId: number,
  runId?: number
): Promise<ActionResult<{ ok: true; forced: boolean }>> {
  if (Number.isNaN(commandId)) return invalidId();
  if (runId != null && Number.isNaN(runId)) return ActionResultFactory.error("Invalid runId", 400);

  return withLock(`command:${commandId}`, async () => {
    let result;
    if (runId != null) {
      const run = await getRunCommandId(runId);
      if (!run || run.command_id !== commandId) {
        return ActionResultFactory.error("Run not found or does not belong to this command", 404);
      }
      result = await stopRun(runId);
    } else {
      result = await stopByCommandId(commandId);
    }

    if (!result.stopped) {
      return ActionResultFactory.error("No running process found for this command", 404);
    }
    return ActionResultFactory.success({ ok: true as const, forced: result.forced });
  });
}

export async function restartCommand(commandId: number): Promise<StartResult> {
  if (Number.isNaN(commandId)) return invalidId();

  return withLock(`command:${commandId}`, async () => {
    const cmd = await getCommandByIdForRun(commandId);
    if (!cmd) return notFound("Command");
    await stopByCommandIdAndWait(commandId);
    return startRun(cmd);
  });
}

export async function createCommand(
  body: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = createCommandSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  const { name, command, cwd, env, autoRestart } = parsed.data;
  const id = await insertCommand(name, command, cwd, JSON.stringify(env), autoRestart);
  const row = (await getCommandById(id))!;

  await broadcastCommands();
  return ActionResultFactory.success(serializeCommand(row));
}

export async function updateCommand(
  id: number,
  body: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = updateCommandSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  return withLock(`command:${id}`, async () => {
    if (!(await commandExists(id))) return notFound("Command");
    if ((await getRunningRunIdByCommandId(id)) !== null) {
      return ActionResultFactory.error("Cannot edit command while it is running", 409);
    }

    const { name, command, cwd, env, autoRestart } = parsed.data;
    await updateCommandFields(id, {
      name,
      command,
      cwd,
      env: env !== undefined ? JSON.stringify(env) : undefined,
      auto_restart: autoRestart !== undefined ? (autoRestart ? 1 : 0) : undefined,
    });

    await broadcastCommands();
    const row = (await getCommandById(id))!;
    return ActionResultFactory.success(serializeCommand(row));
  });
}

export async function deleteCommand(id: number): Promise<ActionResult<{ ok: true }>> {
  if (Number.isNaN(id)) return invalidId();

  return withLock(`command:${id}`, async () => {
    if (!(await commandExists(id))) return notFound("Command");
    if ((await getRunningRunIdByCommandId(id)) !== null) {
      return ActionResultFactory.error("Cannot delete command while it is running", 409);
    }

    const changes = await deleteCommandById(id);
    if (changes === 0) return notFound("Command");

    await broadcastCommands();
    return ActionResultFactory.success({ ok: true as const });
  });
}
