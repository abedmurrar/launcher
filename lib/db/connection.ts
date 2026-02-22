import knex, { type Knex } from "knex";
import path from "path";
import fs from "fs";

// Static relative path so Next/Turbopack can resolve at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const knexfile = require("../../knexfile.js");
const env = process.env.NODE_ENV ?? "development";
const config = knexfile[env] as Knex.Config;

const connectionFilename =
  typeof config.connection === "object" && config.connection !== null && "filename" in config.connection
    ? (config.connection as { filename: string }).filename
    : undefined;

let instancePromise: Promise<Knex> | null = null;

async function createKnex(): Promise<Knex> {
  // Create the directory that actually contains the DB file (from config), so we don't rely on cwd vs __dirname mismatch
  const dbDir = connectionFilename ? path.dirname(path.resolve(connectionFilename)) : path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const db = knex(config);
  await db.raw("PRAGMA journal_mode = WAL");
  await db.migrate.latest();
  return db;
}

/**
 * Singleton: single shared Knex instance per process. Resolves after migrations run.
 */
export function getDb(): Promise<Knex> {
  if (instancePromise === null) {
    instancePromise = createKnex();
  }
  return instancePromise;
}
