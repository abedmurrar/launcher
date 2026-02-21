/** Centralized command action names (single source of truth). */
export const CommandAction = {
  Run: "run",
  Stop: "stop",
  Restart: "restart",
  CreateCommand: "create_command",
  UpdateCommand: "update_command",
  DeleteCommand: "delete_command",
} as const;

export type CommandActionType = (typeof CommandAction)[keyof typeof CommandAction];

export const COMMAND_ACTIONS_LIST: readonly CommandActionType[] =
  Object.values(CommandAction);

/** Centralized group action names (single source of truth). */
export const GroupAction = {
  CreateGroup: "create_group",
  UpdateGroup: "update_group",
  DeleteGroup: "delete_group",
  SetGroupCommands: "set_group_commands",
  RunGroup: "run_group",
} as const;

export type GroupActionType = (typeof GroupAction)[keyof typeof GroupAction];

export const ACTION_TYPES = [
  ...COMMAND_ACTIONS_LIST,
  ...Object.values(GroupAction),
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export type ActionPayload = Record<string, unknown>;

export type ActionResult = { success: boolean; data?: unknown; error?: string; code?: number };

export function isActionType(type: string): type is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(type);
}
