import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { globalSingleton } from "./global-singleton";
import { config } from "./config";

interface CacheEntry {
  value: Promise<string | null>;
  expiresAt: number;
}

const cache = globalSingleton("git-branch-cache", () => new Map<string, CacheEntry>());

function readBranch(cwd: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd, encoding: "utf8", timeout: 2000 },
      (err, stdout) => {
        if (err) return resolve(null);
        const branch = stdout.trim();
        resolve(branch && branch !== "HEAD" ? branch : null);
      }
    );
  });
}

/**
 * Current git branch for a working directory, or null if it isn't a git repo / git is unavailable.
 * Async (never blocks the event loop) and cached per directory for `gitBranchTtlMs`;
 * concurrent lookups for the same directory share one git invocation.
 */
export async function getGitBranch(cwd: string): Promise<string | null> {
  if (!cwd || cwd.trim() === "") return null;
  const resolved = path.resolve(cwd);

  const now = Date.now();
  const hit = cache.get(resolved);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = fs.promises
    .access(resolved)
    .then(() => readBranch(resolved))
    .catch(() => null);
  cache.set(resolved, { value, expiresAt: now + config.gitBranchTtlMs });
  return value;
}
