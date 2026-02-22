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
  insertGroupCommand,
  deleteGroupCommandsByGroupId,
  getCommandByIdForRun,
  updateGroupRunFailed,
} from "@/lib/db/queries";
import { spawnCommand, getRunIdForCommand, killGroupRun } from "@/lib/process-manager";
import { broadcastGroups } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import {
  createGroupSchema,
  updateGroupSchema,
  setGroupCommandsSchema,
} from "./types";
import { formatValidationError, parseEnv, invalidId, notFound } from "./helpers";
import { ActionResultFactory } from "./result-factory";

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

  if (!(await groupExists(id))) return notFound("Group");
  if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
    return ActionResultFactory.error("Cannot edit group while it is running", 409);
  }

  await updateGroupName(parsed.data.name, id);
  await broadcastGroups();
  const row = (await getGroupById(id))! as unknown as Record<string, unknown>;
  return ActionResultFactory.success(row);
}

export async function deleteGroup(id: number): Promise<ActionResult<{ ok: true }>> {
  if (Number.isNaN(id)) return invalidId();

  if (!(await groupExists(id))) return notFound("Group");
  if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
    return ActionResultFactory.error("Cannot delete group while it is running", 409);
  }

  const changes = await deleteGroupById(id);
  if (changes === 0) return notFound("Group");

  await broadcastGroups();
  return ActionResultFactory.success({ ok: true as const });
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

  if (!(await groupExists(id))) return notFound("Group");
  if ((await getRunningGroupRunIdByGroupId(id)) !== undefined) {
    return ActionResultFactory.error("Cannot change group members while the group is running", 409);
  }

  await deleteGroupCommandsByGroupId(id);
  for (let index = 0; index < parsed.data.commandIds.length; index++) {
    await insertGroupCommand(id, parsed.data.commandIds[index], index);
  }

  const rows = await getGroupCommandsByGroupId(id);

  await broadcastGroups();
  return ActionResultFactory.success({ command_ids: rows.map((row) => row.command_id) });
}

export async function runGroup(
  groupId: number
): Promise<ActionResult<{
  group_run_id: number;
  runs: Array<{ run_id: number; command_id: number; pid: number }>;
}>> {
  if (Number.isNaN(groupId)) return invalidId();

  if (!(await groupExists(groupId))) return notFound("Group");

  const runningRunId = await getRunningGroupRunIdByGroupId(groupId);
  if (runningRunId !== undefined) {
    return ActionResultFactory.error("Group is already running", 409);
  }

  const members = await getGroupCommandsByGroupId(groupId);

  if (members.length === 0) {
    return ActionResultFactory.error("Group has no commands", 400);
  }

  const groupRunId = await insertGroupRun(groupId);

  const runs: Array<{ run_id: number; command_id: number; pid: number }> = [];

  for (const m of members) {
    const existingRunId = await getRunIdForCommand(m.command_id);
    if (existingRunId !== null) {
      await updateGroupRunFailed(groupRunId);
      return ActionResultFactory.error("One or more commands are already running", 409);
    }

    const cmd = await getCommandByIdForRun(m.command_id);
    if (!cmd) continue;

    const env = parseEnv(cmd.env);
    const runId = await insertRunWithGroup(m.command_id, groupRunId);
    const pid = spawnCommand(runId, m.command_id, cmd.command, cmd.cwd, env, groupRunId);
    runs.push({ run_id: runId, command_id: m.command_id, pid });
  }

  return ActionResultFactory.success({ group_run_id: groupRunId, runs });
}

export async function stopGroup(groupId: number): Promise<ActionResult<{ ok: true }>> {
  if (Number.isNaN(groupId)) return invalidId();

  if (!(await groupExists(groupId))) return notFound("Group");

  const runningRunId = await getRunningGroupRunIdByGroupId(groupId);
  if (runningRunId === undefined) {
    return ActionResultFactory.error("Group is not running", 404);
  }

  await killGroupRun(runningRunId);
  await broadcastGroups();
  return ActionResultFactory.success({ ok: true as const });
}

export async function restartGroup(
  groupId: number
): Promise<ActionResult<{
  group_run_id: number;
  runs: Array<{ run_id: number; command_id: number; pid: number }>;
}>> {
  if (Number.isNaN(groupId)) return invalidId();

  const runningRunId = await getRunningGroupRunIdByGroupId(groupId);
  if (runningRunId !== undefined) {
    await killGroupRun(runningRunId);
    await broadcastGroups();
  }

  return runGroup(groupId);
}
