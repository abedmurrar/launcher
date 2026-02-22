import { execSync } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Returns the current git branch name for the given working directory, or null
 * if the directory is not a git repo, git is not available, or branch cannot be read.
 */
export function getGitBranch(cwd: string): string | null {
  if (!cwd || cwd.trim() === "") {
    return null;
  }
  let resolved: string;
  try {
    resolved = path.resolve(cwd);
    if (!fs.existsSync(resolved)) return null;
  } catch {
    return null;
  }
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      cwd: resolved,
      timeout: 2000,
    }).trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}
