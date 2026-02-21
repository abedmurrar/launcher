import type { RunRecord } from "./types";
import { getRunningRunIdByCommandId } from "@/lib/db/queries";

/** Observer: notified when run state (e.g. start/stop) changes. */
export type RunStateObserver = () => void;

/** Observer: notified on log chunk and when a run's log stream finishes. */
export type LogEventsObserver = {
  onChunk: (runId: number, content: string, streamType: "stdout" | "stderr") => void;
  onFinished: (runId: number) => void;
};

/**
 * Singleton: single shared process manager state per process
 * (PID maps, runId mapping, group run tracking, and observers).
 * State and behavior are static so there is one shared instance.
 */
class ProcessManagerStateSingleton {
  static readonly pidMap = new Map<number, RunRecord>();
  static readonly runIdToPid = new Map<number, number>();
  static readonly groupRunIdToPids = new Map<number, number[]>();

  private static readonly runStateObservers = new Set<RunStateObserver>();
  private static readonly logEventsObservers = new Set<LogEventsObserver>();

  private constructor() {}

  /** Observer pattern: subscribe to run state changes. Returns unsubscribe. */
  static subscribeRunStateChange(observer: RunStateObserver): () => void {
    ProcessManagerStateSingleton.runStateObservers.add(observer);
    return () => {
      ProcessManagerStateSingleton.runStateObservers.delete(observer);
    };
  }

  /** Observer pattern: subscribe to log chunk/finished events. Returns unsubscribe. */
  static subscribeLogEvents(observer: LogEventsObserver): () => void {
    ProcessManagerStateSingleton.logEventsObservers.add(observer);
    return () => {
      ProcessManagerStateSingleton.logEventsObservers.delete(observer);
    };
  }

  /** Backward compat: single callback (replaces previous). */
  static setRunStateChangeCallback(callback: () => void): void {
    ProcessManagerStateSingleton.runStateObservers.clear();
    ProcessManagerStateSingleton.runStateObservers.add(callback);
  }

  /** Backward compat: single log hooks (replaces previous). */
  static setLogHooks(hooks: LogEventsObserver): void {
    ProcessManagerStateSingleton.logEventsObservers.clear();
    ProcessManagerStateSingleton.logEventsObservers.add(hooks);
  }

  static notifyRunStateChange(): void {
    ProcessManagerStateSingleton.runStateObservers.forEach((observer) => observer());
  }

  static emitLogToHooks(runId: number, content: string, streamType: "stdout" | "stderr"): void {
    ProcessManagerStateSingleton.logEventsObservers.forEach((observer) =>
      observer.onChunk(runId, content, streamType)
    );
  }

  static notifyLogFinished(runId: number): void {
    ProcessManagerStateSingleton.logEventsObservers.forEach((observer) => observer.onFinished(runId));
  }

  static getRunIdForCommand(commandId: number): number | null {
    return getRunningRunIdByCommandId(commandId);
  }

  static getRunningRunIds(): number[] {
    return Array.from(ProcessManagerStateSingleton.runIdToPid.keys());
  }

  static isRunLive(runId: number): boolean {
    return ProcessManagerStateSingleton.runIdToPid.has(runId);
  }
}

export const pidMap = ProcessManagerStateSingleton.pidMap;
export const runIdToPid = ProcessManagerStateSingleton.runIdToPid;
export const groupRunIdToPids = ProcessManagerStateSingleton.groupRunIdToPids;

export function getProcessManagerState(): typeof ProcessManagerStateSingleton {
  return ProcessManagerStateSingleton;
}

export function subscribeRunStateChange(observer: RunStateObserver): () => void {
  return ProcessManagerStateSingleton.subscribeRunStateChange(observer);
}

export function subscribeLogEvents(observer: LogEventsObserver): () => void {
  return ProcessManagerStateSingleton.subscribeLogEvents(observer);
}

export function setRunStateChangeCallback(callback: () => void): void {
  ProcessManagerStateSingleton.setRunStateChangeCallback(callback);
}

export function setLogHooks(hooks: LogEventsObserver): void {
  ProcessManagerStateSingleton.setLogHooks(hooks);
}

export function notifyRunStateChange(): void {
  ProcessManagerStateSingleton.notifyRunStateChange();
}

export function emitLogToHooks(runId: number, content: string, streamType: "stdout" | "stderr"): void {
  ProcessManagerStateSingleton.emitLogToHooks(runId, content, streamType);
}

export function notifyLogFinished(runId: number): void {
  ProcessManagerStateSingleton.notifyLogFinished(runId);
}

export function getRunIdForCommand(commandId: number): number | null {
  return ProcessManagerStateSingleton.getRunIdForCommand(commandId);
}

export function getRunningRunIds(): number[] {
  return ProcessManagerStateSingleton.getRunningRunIds();
}

export function isRunLive(runId: number): boolean {
  return ProcessManagerStateSingleton.isRunLive(runId);
}
