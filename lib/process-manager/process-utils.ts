import os from "os";

export function getSystemBootTime(): Date {
  return new Date(Date.now() - os.uptime() * 1000);
}

export function isProcessAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    if (code === "EPERM") return true;
    return false;
  }
}

/** Parse SQLite datetime('now') text as UTC for comparison with boot time. */
export function parseSqliteDatetime(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  return new Date(normalized);
}
