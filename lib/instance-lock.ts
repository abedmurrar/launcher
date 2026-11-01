import fs from "fs";
import path from "path";
import { getDataDir } from "@/lib/config";
import { getBootId, getProcessStartTime, isSameProcess } from "@/lib/process-manager/identity";

/**
 * One launcher per data directory. Two launchers on the same DB would both adopt and finalize
 * the same runs. The lock records (pid, start time, boot id), so a stale lock (crashed launcher,
 * reboot, reused pid) is detected and taken over.
 */

interface LockInfo {
  pid: number;
  startTime: string | null;
  bootId: string;
}

function lockPath(): string {
  return path.join(getDataDir(), "launcher.lock");
}

function readLock(file: string): LockInfo | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as LockInfo;
  } catch {
    return null;
  }
}

export class InstanceLockError extends Error {}

/** Acquire the lock or throw InstanceLockError if another live launcher holds it. */
export function acquireInstanceLock(): void {
  const file = lockPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const mine: LockInfo = { pid: process.pid, startTime: getProcessStartTime(process.pid), bootId: getBootId() };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify(mine), { flag: "wx" });
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    const holder = readLock(file);
    if (
      holder &&
      holder.pid !== process.pid &&
      isSameProcess({ pid: holder.pid, pidStartTime: holder.startTime, bootId: holder.bootId })
    ) {
      throw new InstanceLockError(
        `Another launcher (pid ${holder.pid}) is already running with data directory ${getDataDir()}. ` +
          `Stop it first, or use a different LAUNCHER_DATA_DIR.`
      );
    }
    // Stale (or ours): remove and retry once.
    fs.rmSync(file, { force: true });
  }
  throw new InstanceLockError(`Could not acquire ${file}`);
}

export function releaseInstanceLock(): void {
  const file = lockPath();
  const holder = readLock(file);
  if (holder?.pid === process.pid) fs.rmSync(file, { force: true });
}
