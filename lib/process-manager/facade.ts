import {
  getProcessManagerState,
  subscribeRunStateChange,
  subscribeLogEvents,
  setRunStateChangeCallback,
  setLogHooks,
  getRunIdForCommand,
  getRunningRunIds,
  isRunLive,
} from "./state";
import { spawnCommand } from "./spawn";
import { stopRun, stopByCommandId, stopByCommandIdAndWait } from "./stop";
import { registerSSEWriter } from "./log";

/**
 * Facade: single entry point for process management (spawn, stop, state, logs).
 */
export const processManager = {
  spawnCommand,
  stopRun,
  stopByCommandId,
  stopByCommandIdAndWait,
  getRunIdForCommand,
  getRunningRunIds,
  isRunLive,
  registerSSEWriter,
  getState: getProcessManagerState,
  subscribeRunStateChange,
  subscribeLogEvents,
  setRunStateChangeCallback,
  setLogHooks,
} as const;
