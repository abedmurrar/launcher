import fs from "fs";
import os from "os";
import { execFileSync } from "child_process";
import crypto from "crypto";
import { globalSingleton } from "@/lib/global-singleton";
import { getDataDir } from "@/lib/config";

/**
 * Process identity: a pid alone is not an identity (pids get reused), so a run records
 * (pid, process start time, boot id). A process "is" the run's process only if all three match.
 *
 * Linux reads /proc directly (cheap, no subprocesses). macOS falls back to `ps`/`sysctl`.
 */

const linux = process.platform === "linux";
const cache = globalSingleton("identity-cache", () => ({
  bootId: null as string | null,
  clkTck: null as number | null,
  btime: null as number | null,
}));

/** Stable id of the current boot (changes on every reboot, unaffected by clock changes). */
export function getBootId(): string {
  if (cache.bootId) return cache.bootId;
  let id: string | null = null;
  try {
    if (linux) id = fs.readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
    else if (process.platform === "darwin") {
      // "{ sec = 1700000000, usec = 123 } ..." → stable per boot
      const out = execFileSync("sysctl", ["-n", "kern.boottime"], { encoding: "utf8" });
      id = /sec = (\d+)/.exec(out)?.[1] ?? null;
    }
  } catch {
    id = null;
  }
  // Fallback: boot time rounded to 10s (os.uptime drifts slightly between calls).
  cache.bootId = id || `boot-${Math.round((Date.now() / 1000 - os.uptime()) / 10)}`;
  return cache.bootId;
}

function clockTicksPerSecond(): number {
  if (cache.clkTck == null) {
    try {
      cache.clkTck = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }).trim()) || 100;
    } catch {
      cache.clkTck = 100;
    }
  }
  return cache.clkTck;
}

function bootEpochSeconds(): number {
  if (cache.btime == null) {
    try {
      const m = /^btime (\d+)$/m.exec(fs.readFileSync("/proc/stat", "utf8"));
      cache.btime = m ? Number(m[1]) : Math.round(Date.now() / 1000 - os.uptime());
    } catch {
      cache.btime = Math.round(Date.now() / 1000 - os.uptime());
    }
  }
  return cache.btime;
}

interface ProcStat {
  pgrp: number;
  /** Start time in clock ticks since boot (Linux), as a string token. */
  startTime: string;
}

/** Parse /proc/<pid>/stat (the comm field may contain spaces/parens: parse after the last ')'). */
function readProcStat(pid: number): ProcStat | null {
  try {
    const raw = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
    const rest = raw.slice(raw.lastIndexOf(")") + 2).split(" ");
    // rest[0] = state (field 3), so field N is rest[N - 3]
    if (rest[0] === "Z" || rest[0] === "X") return null; // zombie/dead: not running
    return { pgrp: Number(rest[5 - 3]), startTime: rest[22 - 3] };
  } catch {
    return null;
  }
}

/** Opaque start-time token for a live process, or null if it doesn't exist (or is a zombie). */
export function getProcessStartTime(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (linux) return readProcStat(pid)?.startTime ?? null;
  try {
    const out = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], { encoding: "utf8" }).trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Wall-clock start time of a live process (used to vet legacy runs without a stored token). */
function getProcessStartDate(pid: number): Date | null {
  const token = getProcessStartTime(pid);
  if (!token) return null;
  if (linux) return new Date((bootEpochSeconds() + Number(token) / clockTicksPerSecond()) * 1000);
  const d = new Date(token);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface RunIdentity {
  pid: number | null;
  pidStartTime: string | null;
  bootId: string | null;
  /** Run start (SQLite UTC text), used only for rows recorded before identity existed. */
  startedAt?: string | null;
}

/** True only if `pid` is still the exact process the run started. Never trusts a bare pid. */
export function isSameProcess(id: RunIdentity): boolean {
  const pid = id.pid ?? 0;
  if (pid <= 0) return false;
  if (id.bootId && id.bootId !== getBootId()) return false;
  const current = getProcessStartTime(pid);
  if (current == null) return false;
  if (id.pidStartTime) return current === id.pidStartTime;
  // Legacy row (no token): accept only if the process started within 10s of the run.
  if (!id.startedAt) return false;
  const runStart = new Date(id.startedAt.includes("T") ? id.startedAt : id.startedAt.replace(" ", "T") + "Z");
  const procStart = getProcessStartDate(pid);
  return procStart != null && Math.abs(procStart.getTime() - runStart.getTime()) < 10_000;
}

/** Environment marker set on every managed command; inherited by all of its descendants. */
export const RUN_MARKER = "LAUNCHER_RUN_ID";

/**
 * Marker value for a run: "<data-dir hash>:<run id>". Run ids are only unique within one
 * database, so the data directory is part of the value; two launchers (e.g. a dev copy and the
 * live one) never match each other's processes.
 */
export function runMarkerValue(runId: number): string {
  const scope = crypto.createHash("sha1").update(getDataDir()).digest("hex").slice(0, 8);
  return `${scope}:${runId}`;
}

export interface ProcessRef {
  pid: number;
  startTime: string;
}

/**
 * Live processes belonging to a run (Linux): everything carrying LAUNCHER_RUN_ID=<runId>, plus
 * members of the leader's process group. Finds a run's processes even if the leader died or
 * its pid was never recorded. Returns [] on other platforms.
 */
export function findRunProcesses(
  runId: number,
  leaderPid?: number | null,
  /** Only accept process-group matches that started at/after this (the leader's start token). */
  leaderStartTime?: string | null
): ProcessRef[] {
  if (!linux) return [];
  const marker = Buffer.from(`${RUN_MARKER}=${runMarkerValue(runId)}\0`);
  const self = process.pid;
  const found: ProcessRef[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync("/proc");
  } catch {
    return [];
  }
  for (const name of entries) {
    if (name.charCodeAt(0) < 48 || name.charCodeAt(0) > 57) continue; // not a pid dir
    const pid = Number(name);
    if (pid === self) continue;
    const stat = readProcStat(pid);
    if (!stat) continue;
    let match =
      leaderPid != null &&
      leaderPid > 0 &&
      stat.pgrp === leaderPid &&
      (leaderStartTime == null || Number(stat.startTime) >= Number(leaderStartTime));
    if (!match) {
      try {
        const env = fs.readFileSync(`/proc/${pid}/environ`);
        // Match "\0LAUNCHER_RUN_ID=<id>\0" or at the very start of the block.
        const idx = env.indexOf(marker);
        match = idx === 0 || (idx > 0 && env[idx - 1] === 0);
      } catch {
        // other user's process or exited
      }
    }
    if (match) found.push({ pid, startTime: stat.startTime });
  }
  return found;
}

/** Process group id of a live process (Linux), or null. */
export function getProcessGroup(pid: number): number | null {
  return linux ? (readProcStat(pid)?.pgrp ?? null) : null;
}

/** True if this exact process (pid + start time) is still alive. */
export function isAlive(ref: ProcessRef): boolean {
  return getProcessStartTime(ref.pid) === ref.startTime;
}
