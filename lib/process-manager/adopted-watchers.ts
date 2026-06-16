const watchers = new Map<number, ReturnType<typeof setInterval>>();

export function registerWatcher(runId: number, interval: ReturnType<typeof setInterval>): void {
  stopWatcher(runId);
  watchers.set(runId, interval);
}

export function stopWatcher(runId: number): void {
  const interval = watchers.get(runId);
  if (interval !== undefined) {
    clearInterval(interval);
    watchers.delete(runId);
  }
}

export function hasWatcher(runId: number): boolean {
  return watchers.has(runId);
}
