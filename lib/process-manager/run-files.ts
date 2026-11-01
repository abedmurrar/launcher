import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import type { StdioOptions } from "child_process";
import { getDataDir } from "@/lib/config";

export type StreamType = "stdout" | "stderr";

export function getLogsDir(): string {
  return path.join(getDataDir(), "logs");
}

export function runFilePaths(runId: number) {
  const dir = getLogsDir();
  return {
    stdout: path.join(dir, `${runId}.stdout`),
    stderr: path.join(dir, `${runId}.stderr`),
    stdin: path.join(dir, `${runId}.stdin`),
  };
}

/** True when this platform runs commands with file-backed stdio (POSIX). */
export function fileStdioSupported(): boolean {
  return process.platform !== "win32";
}

export interface RunFiles {
  stdio: StdioOptions;
  /** Close the launcher's copies of the fds once the child has them. */
  closeParentFds: () => void;
}

/**
 * Create a run's output files and stdin FIFO, returning stdio for spawn().
 * Output goes to files (not pipes) so the process survives a launcher restart and nothing is lost.
 * stdin is a FIFO opened read-write by the child itself, so it never sees EOF even after the
 * launcher exits (tools like `esbuild --watch` exit on stdin EOF). Falls back to a pipe.
 */
export function openRunFiles(runId: number): RunFiles {
  const paths = runFilePaths(runId);
  fs.mkdirSync(getLogsDir(), { recursive: true });

  const fds: number[] = [];
  const outFd = fs.openSync(paths.stdout, "a");
  fds.push(outFd);
  const errFd = fs.openSync(paths.stderr, "a");
  fds.push(errFd);

  let stdin: number | "pipe" = "pipe";
  try {
    fs.rmSync(paths.stdin, { force: true });
    execFileSync("mkfifo", [paths.stdin], { stdio: "ignore" });
    stdin = fs.openSync(paths.stdin, "r+");
    fds.push(stdin);
  } catch {
    stdin = "pipe";
  }

  return {
    stdio: [stdin, outFd, errFd],
    closeParentFds: () => {
      for (const fd of fds) {
        try {
          fs.closeSync(fd);
        } catch {
          // already closed
        }
      }
      fds.length = 0;
    },
  };
}

export function runFilesExist(runId: number): boolean {
  const p = runFilePaths(runId);
  return fs.existsSync(p.stdout) || fs.existsSync(p.stderr);
}

export function removeRunFiles(runId: number): void {
  const p = runFilePaths(runId);
  for (const file of [p.stdout, p.stderr, p.stdin]) {
    try {
      fs.rmSync(file, { force: true });
    } catch (err) {
      console.error(`[run ${runId}] failed to remove ${file}:`, err);
    }
  }
}

/** Delete run files in the logs dir whose run id is not in `keep`. */
export function removeStrayRunFiles(keep: Set<number>): number {
  let removed = 0;
  let entries: string[];
  try {
    entries = fs.readdirSync(getLogsDir());
  } catch {
    return 0;
  }
  for (const name of entries) {
    const match = /^(\d+)\.(stdout|stderr|stdin)$/.exec(name);
    if (!match || keep.has(Number(match[1]))) continue;
    try {
      fs.rmSync(path.join(getLogsDir(), name), { force: true });
      removed++;
    } catch {
      // ignore
    }
  }
  return removed;
}

/**
 * Length of the longest prefix of `buf` that does not end in the middle of a UTF-8 sequence,
 * so a multi-byte character split across reads is decoded on the next read instead.
 */
export function utf8SafeLength(buf: Buffer): number {
  const len = buf.length;
  for (let i = len - 1; i >= Math.max(0, len - 4); i--) {
    const b = buf[i];
    if ((b & 0xc0) === 0x80) continue; // continuation byte
    const needed = b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : b >= 0xc0 ? 2 : 1;
    return len - i < needed ? i : len;
  }
  return len;
}
