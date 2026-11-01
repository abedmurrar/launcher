import {
  subscribeRunStateChange,
  subscribeLogEvents,
  getRunIdForCommand,
  getRunningRunIds,
  isRunLive,
} from "./state";
import { spawnCommand } from "./spawn";
import { stopRun, stopByCommandId, stopByCommandIdAndWait } from "./stop";

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
  subscribeRunStateChange,
  subscribeLogEvents,
} as const;
