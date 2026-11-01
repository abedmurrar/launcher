import knex, { type Knex } from "knex";
import path from "path";
import fs from "fs";
import { globalSingleton } from "../global-singleton";

// Static relative path so Next/Turbopack can resolve at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const knexfile = require("../../knexfile.js");
const env = process.env.NODE_ENV ?? "development";
const config = knexfile[env] as Knex.Config;

const connectionFilename =
  typeof config.connection === "object" && config.connection !== null && "filename" in config.connection
    ? (config.connection as { filename: string }).filename
    : undefined;

async function createKnex(): Promise<Knex> {
  // Create the directory that actually contains the DB file (from config), so we don't rely on cwd vs __dirname mismatch
  const dbDir = connectionFilename ? path.dirname(path.resolve(connectionFilename)) : path.join(process.cwd(), "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const db = knex(config);
  await db.migrate.latest();
  return db;
}

const holder = globalSingleton("db", () => ({ instance: null as Promise<Knex> | null }));

/**
 * Singleton: single shared Knex instance per process (shared between the custom
 * server and Next route handlers). Resolves after migrations run.
 */
export function getDb(): Promise<Knex> {
  if (holder.instance === null) {
    holder.instance = createKnex().catch((err) => {
      holder.instance = null;
      throw err;
    });
  }
  return holder.instance;
}

export async function closeDb(): Promise<void> {
  if (holder.instance === null) return;
  const db = await holder.instance.catch(() => null);
  holder.instance = null;
  await db?.destroy();
}
