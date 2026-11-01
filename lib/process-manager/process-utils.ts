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

/** True while any process in the process group led by `pid` exists (POSIX), else falls back to the pid. */
export function isProcessGroupAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  if (process.platform === "win32") return isProcessAlive(pid);
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll `check` every `intervalMs` until it returns true or `timeoutMs` elapses. Returns the last result. */
export async function waitFor(
  check: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 50
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
}
