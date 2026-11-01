/** Human-readable reason a run ended (see EndReason in lib/process-manager/types.ts). */
export function describeEnd(
  reason: string | null | undefined,
  exitCode: number | null | undefined,
  status?: string | null
): string | null {
  switch (true) {
    case reason === "exited":
      return null;
    case reason === "failed":
      return exitCode != null ? `exit ${exitCode}` : "failed";
    case reason === "stopped":
      return "stopped";
    case reason === "group_failed":
      return "stopped: group member failed";
    case reason?.startsWith("signal:"):
      return `killed (${reason!.slice(7)})`;
    case reason === "ended":
      return "ended";
    case reason === "launcher_down":
      return "ended while launcher was down";
    case reason === "reboot":
      return "machine restarted";
    case reason === "spawn_failed":
      return "failed to start";
  }
  // Runs recorded before end reasons existed.
  if (status === "killed") return "stopped";
  if (exitCode != null && exitCode !== 0) return `exit ${exitCode}`;
  return null;
}
