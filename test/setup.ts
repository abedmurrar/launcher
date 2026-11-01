import fs from "fs";
import os from "os";
import path from "path";
import { afterAll } from "vitest";

// Fresh DB per test file. Must run before any lib/ module is imported.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "launcher-test-"));
process.env.LAUNCHER_DATA_DIR = dataDir;

// Clear shared process state left by a previous file in the same worker.
for (const key of Object.keys(globalThis)) {
  if (key.startsWith("__launcher_")) delete (globalThis as Record<string, unknown>)[key];
}

afterAll(async () => {
  const { killAllTracked } = await import("./helpers");
  await killAllTracked();
  const { closeDb } = await import("@/lib/db/connection");
  await closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
