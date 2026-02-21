import type { ActionResult, OkResult, ErrResult } from "./types";
import { ActionResultFactory } from "./result-factory";
import {
  runCommand,
  stopCommand,
  restartCommand,
  createCommand,
  updateCommand,
  deleteCommand,
} from "./commands";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupCommands,
  runGroup,
} from "./groups";

/**
 * Facade: single entry point for command and group actions plus result factory.
 */
export const actions = {
  result: ActionResultFactory,
  commands: {
    run: runCommand,
    stop: stopCommand,
    restart: restartCommand,
    create: createCommand,
    update: updateCommand,
    delete: deleteCommand,
  },
  groups: {
    create: createGroup,
    update: updateGroup,
    delete: deleteGroup,
    setCommands: setGroupCommands,
    run: runGroup,
  },
} as const;

export type { ActionResult, OkResult, ErrResult };
