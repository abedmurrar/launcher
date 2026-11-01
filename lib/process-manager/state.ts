import type { EndReason, RunRecord } from "./types";
import { getRunningRunIdByCommandId } from "@/lib/db/queries";
import { globalSingleton } from "@/lib/global-singleton";

/** Observer: notified when run state (e.g. start/stop) changes. */
export type RunStateObserver = () => void;

export interface LiveLogChunk {
  streamType: "stdout" | "stderr";
  data: string;
}

/**
 * Observer: notified with batched log output and when a run's log stream finishes.
 * `lastId` is the DB id of the last persisted chunk in the batch (undefined if the write failed),
 * letting clients de-duplicate against history.
 */
export interface LogEventsObserver {
  onBatch: (runId: number, chunks: LiveLogChunk[], lastId: number | undefined) => void;
  onFinished: (runId: number) => void;
}

/**
 * Single shared process manager state per Node process (PID maps, group run tracking,
 * observers). Stored on globalThis so the custom server and Next route handlers share it.
 */
const state = globalSingleton("process-manager-state", () => ({
  pidMap: new Map<number, RunRecord>(),
  runIdToPid: new Map<number, number>(),
  groupRunIdToPids: new Map<number, number[]>(),
  runStateObservers: new Set<RunStateObserver>(),
  logEventsObservers: new Set<LogEventsObserver>(),
  /** Why the launcher is stopping a run (consumed when the run is finalized). */
  stopReasons: new Map<number, EndReason>(),
}));

/** Record that the launcher itself is stopping this run, and why. */
export function markStopReason(runId: number, reason: EndReason): void {
  if (!state.stopReasons.has(runId)) state.stopReasons.set(runId, reason);
}

export function consumeStopReason(runId: number): EndReason | undefined {
  const reason = state.stopReasons.get(runId);
  state.stopReasons.delete(runId);
  return reason;
}

/** The run's process is a child of this launcher (we get its exit event). */
export function isOwnedRun(runId: number): boolean {
  const pid = state.runIdToPid.get(runId);
  const record = pid !== undefined ? state.pidMap.get(pid) : undefined;
  return !!record?.childProcess && record.runId === runId;
}

export const pidMap = state.pidMap;
export const runIdToPid = state.runIdToPid;
export const groupRunIdToPids = state.groupRunIdToPids;

function safeCall(fn: () => void, label: string): void {
  try {
    fn();
  } catch (err) {
    console.error(`[process-manager] ${label} observer failed:`, err);
  }
}

/** Observer pattern: subscribe to run state changes. Returns unsubscribe. */
export function subscribeRunStateChange(observer: RunStateObserver): () => void {
  state.runStateObservers.add(observer);
  return () => {
    state.runStateObservers.delete(observer);
  };
}

/** Observer pattern: subscribe to log chunk/finished events. Returns unsubscribe. */
export function subscribeLogEvents(observer: LogEventsObserver): () => void {
  state.logEventsObservers.add(observer);
  return () => {
    state.logEventsObservers.delete(observer);
  };
}

export function notifyRunStateChange(): void {
  state.runStateObservers.forEach((observer) => safeCall(observer, "run state"));
}

export function emitLogBatchToHooks(
  runId: number,
  chunks: LiveLogChunk[],
  lastId: number | undefined
): void {
  state.logEventsObservers.forEach((observer) =>
    safeCall(() => observer.onBatch(runId, chunks, lastId), "log batch")
  );
}

export function notifyLogFinished(runId: number): void {
  state.logEventsObservers.forEach((observer) =>
    safeCall(() => observer.onFinished(runId), "log finished")
  );
}

export function getRunIdForCommand(commandId: number): Promise<number | null> {
  return getRunningRunIdByCommandId(commandId);
}

export function getRunningRunIds(): number[] {
  return Array.from(state.runIdToPid.keys());
}

export function isRunLive(runId: number): boolean {
  return state.runIdToPid.has(runId);
}
