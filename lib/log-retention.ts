import { pruneLogChunks } from "@/lib/db/queries";
import { config } from "@/lib/config";

export async function runLogRetention(): Promise<void> {
  try {
    const deleted = await pruneLogChunks(config.logRetainRunsPerCommand, config.logRetainDays);
    if (deleted > 0) {
      console.log(`[retention] deleted ${deleted} old log chunks`);
    }
  } catch (err) {
    console.error("[retention] failed:", err);
  }
}

/** Prune now and then every `logRetentionIntervalMs`. Returns a stop function. */
export function startLogRetention(): () => void {
  void runLogRetention();
  if (config.logRetentionIntervalMs <= 0) return () => {};
  const timer = setInterval(() => void runLogRetention(), config.logRetentionIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
