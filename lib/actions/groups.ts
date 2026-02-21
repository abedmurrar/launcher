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
import { spawnCommand, getRunIdForCommand } from "@/lib/process-manager";
import { broadcastGroups } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import {
  createGroupSchema,
  updateGroupSchema,
  setGroupCommandsSchema,
} from "./types";
import { formatValidationError, parseEnv, invalidId, notFound } from "./helpers";
import { ActionResultFactory } from "./result-factory";

export function createGroup(
  body: unknown
): ActionResult<Record<string, unknown>> {
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  const id = insertGroup(parsed.data.name);
  const row = getGroupById(id)! as Record<string, unknown>;

  broadcastGroups();
  return ActionResultFactory.success(row);
}

export function updateGroup(
  id: number,
  body: unknown
): ActionResult<Record<string, unknown>> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  if (!groupExists(id)) return notFound("Group");

  updateGroupName(parsed.data.name, id);
  broadcastGroups();
  const row = getGroupById(id)! as Record<string, unknown>;
  return ActionResultFactory.success(row);
}

export function deleteGroup(id: number): ActionResult<{ ok: true }> {
  if (Number.isNaN(id)) return invalidId();

  const changes = deleteGroupById(id);
  if (changes === 0) return notFound("Group");

  broadcastGroups();
  return ActionResultFactory.success({ ok: true as const });
}

export function setGroupCommands(
  id: number,
  body: unknown
): ActionResult<{ command_ids: number[] }> {
  if (Number.isNaN(id)) return invalidId();

  const parsed = setGroupCommandsSchema.safeParse(body);
  if (!parsed.success) {
    return ActionResultFactory.error(formatValidationError(parsed.error), 400);
  }

  if (!groupExists(id)) return notFound("Group");

  deleteGroupCommandsByGroupId(id);
  parsed.data.commandIds.forEach((commandId, index) => {
    insertGroupCommand(id, commandId, index);
  });

  const rows = getGroupCommandsByGroupId(id);

  broadcastGroups();
  return ActionResultFactory.success({ command_ids: rows.map((row) => row.command_id) });
}

export function runGroup(
  groupId: number
): ActionResult<{
  group_run_id: number;
  runs: Array<{ run_id: number; command_id: number; pid: number }>;
}> {
  if (Number.isNaN(groupId)) return invalidId();

  if (!groupExists(groupId)) return notFound("Group");

  const runningRunId = getRunningGroupRunIdByGroupId(groupId);
  if (runningRunId !== undefined) {
    return ActionResultFactory.error("Group is already running", 409);
  }

  const members = getGroupCommandsByGroupId(groupId);

  if (members.length === 0) {
    return ActionResultFactory.error("Group has no commands", 400);
  }

  const groupRunId = insertGroupRun(groupId);

  const runs: Array<{ run_id: number; command_id: number; pid: number }> = [];

  for (const m of members) {
    const existingRunId = getRunIdForCommand(m.command_id);
    if (existingRunId !== null) {
      updateGroupRunFailed(groupRunId);
      return ActionResultFactory.error("One or more commands are already running", 409);
    }

    const cmd = getCommandByIdForRun(m.command_id);
    if (!cmd) continue;

    const env = parseEnv(cmd.env);
    const runId = insertRunWithGroup(m.command_id, groupRunId);
    const pid = spawnCommand(runId, m.command_id, cmd.command, cmd.cwd, env, groupRunId);
    runs.push({ run_id: runId, command_id: m.command_id, pid });
  }

  return ActionResultFactory.success({ group_run_id: groupRunId, runs });
}
