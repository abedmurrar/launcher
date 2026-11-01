import {
  insertGroup,
  getGroupById,
  groupExists,
  updateGroupName,
  deleteGroup as deleteGroupById,
  getGroupCommandsByGroupId,
  getRunningGroupRunIdByGroupId,
  insertGroupRun,
  insertRunWithGroup,
  replaceGroupCommands,
  getCommandByIdForRun,
  updateRunStatusFailed,
} from "@/lib/db/queries";
import { spawnCommand, getRunIdForCommand, killGroupRun } from "@/lib/process-manager";
import { broadcastGroups } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import {
  createGroupSchema,
  updateGroupSchema,
  setGroupCommandsSchema,
} from "./types";
import {
  formatValidationError,
  parseEnv,
  invalidId,
  notFound,
  withLock,
  isUniqueViolation,
  isForeignKeyViolation,
} from "./helpers";
import { ActionResultFactory } from "./result-factory";

type GroupRunResult = ActionResult<{
  group_run_id: number;
  runs: Array<{ run_id: number; command_id: number; pid: number }>;
}>;

const groupLockKey = (id: number) => `group:${id}`;

export async function createGroup(
  body: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  const id = await insertGroup(parsed.data.name);
  const row = (await getGroupById(id))! as unknown as Record<string, unknown>;

  await broadcastGroups();
  return ActionResultFactory.success(row);
}

export async function updateGroup(
  id: number,
  body: unknown
): Promise<ActionResult<Record<string, unknown>>> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  return withLock(groupLockKey(id), async () => {
    if (!(await groupExists(id))) return notFound("Group");
    if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
      return ActionResultFactory.error("Cannot edit group while it is running", 409);
    }

    await updateGroupName(parsed.data.name, id);
    await broadcastGroups();
    const row = (await getGroupById(id))! as unknown as Record<string, unknown>;
    return ActionResultFactory.success(row);
  });
}

export async function deleteGroup(id: number): Promise<ActionResult<{ ok: true }>> {
  if (Number.isNaN(id)) return invalidId();

  return withLock(groupLockKey(id), async () => {
    if (!(await groupExists(id))) return notFound("Group");
    if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
      return ActionResultFactory.error("Cannot delete group while it is running", 409);
    }

    const changes = await deleteGroupById(id);
    if (changes === 0) return notFound("Group");

    await broadcastGroups();
    return ActionResultFactory.success({ ok: true as const });
  });
}

export async function setGroupCommands(
  id: number,
  body: unknown
): Promise<ActionResult<{ command_ids: number[] }>> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = setGroupCommandsSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  return withLock(groupLockKey(id), async () => {
    if (!(await groupExists(id))) return notFound("Group");
    if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
      return ActionResultFactory.error("Cannot change group members while the group is running", 409);
    }

    const commandIds = [...new Set(parsed.data.commandIds)];
    try {
      await replaceGroupCommands(id, commandIds);
    } catch (err) {
      if (isForeignKeyViolation(err)) {
        return ActionResultFactory.error("One or more commands do not exist", 400);
      }
      throw err;
    }

    const rows = await getGroupCommandsByGroupId(id);
    await broadcastGroups();
    return ActionResultFactory.success({ command_ids: rows.map((row) => row.command_id) });
  });
}

/** Start every member of a group. Caller must hold the group lock. */
async function startGroupRun(groupId: number): Promise<GroupRunResult> {
  if (!(await groupExists(groupId))) return notFound("Group");

  if ((await getRunningGroupRunIdByGroupId(groupId)) !== undefined) {
    return ActionResultFactory.error("Group is already running", 409);
  }

  const members = await getGroupCommandsByGroupId(groupId);
  if (members.length === 0) {
    return ActionResultFactory.error("Group has no commands", 400);
  }

  // Check every member up front so we never start half a group and then bail out.
  const commands = [];
  for (const m of members) {
    if ((await getRunIdForCommand(m.command_id)) !== null) {
      return ActionResultFactory.error("One or more commands are already running", 409);
    }
    const cmd = await getCommandByIdForRun(m.command_id);
    if (cmd) commands.push(cmd);
  }

  let groupRunId: number;
  try {
    groupRunId = await insertGroupRun(groupId);
  } catch (err) {
    if (isUniqueViolation(err)) return ActionResultFactory.error("Group is already running", 409);
    throw err;
  }

  const runs: Array<{ run_id: number; command_id: number; pid: number }> = [];

  for (const cmd of commands) {
    let runId: number;
    try {
      runId = await insertRunWithGroup(cmd.id, groupRunId);
    } catch (err) {
      // A member was started individually in the meantime.
      await killGroupRun(groupRunId, "failed");
      await broadcastGroups();
      if (isUniqueViolation(err)) {
        return ActionResultFactory.error("One or more commands are already running", 409);
      }
      throw err;
    }

    try {
      const pid = await spawnCommand(runId, cmd.id, cmd.command, cmd.cwd, parseEnv(cmd.env), groupRunId);
      runs.push({ run_id: runId, command_id: cmd.id, pid });
    } catch (err) {
      await updateRunStatusFailed(runId);
      await killGroupRun(groupRunId, "failed");
      await broadcastGroups();
      const message = err instanceof Error ? err.message : "Failed to start process";
      return ActionResultFactory.error(`Failed to start "${cmd.name}": ${message}`, 500);
    }
  }

  return ActionResultFactory.success({ group_run_id: groupRunId, runs });
}

export async function runGroup(groupId: number): Promise<GroupRunResult> {
  if (Number.isNaN(groupId)) return invalidId();
  return withLock(groupLockKey(groupId), () => startGroupRun(groupId));
}

export async function stopGroup(
  groupId: number
): Promise<ActionResult<{ ok: true; forced: boolean }>> {
  if (Number.isNaN(groupId)) return invalidId();

  return withLock(groupLockKey(groupId), async () => {
    if (!(await groupExists(groupId))) return notFound("Group");

    const runningRunId = await getRunningGroupRunIdByGroupId(groupId);
    if (runningRunId === undefined) {
      return ActionResultFactory.error("Group is not running", 404);
    }

    const { forced } = await killGroupRun(runningRunId, "killed");
    await broadcastGroups();
    return ActionResultFactory.success({ ok: true as const, forced });
  });
}

export async function restartGroup(groupId: number): Promise<GroupRunResult> {
  if (Number.isNaN(groupId)) return invalidId();

  return withLock(groupLockKey(groupId), async () => {
    const runningRunId = await getRunningGroupRunIdByGroupId(groupId);
    if (runningRunId !== undefined) {
      await killGroupRun(runningRunId, "killed");
      await broadcastGroups();
    }
    return startGroupRun(groupId);
  });
}
