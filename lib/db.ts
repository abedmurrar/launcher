import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "launcher.db");

let db: Database.Database | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (!db) {
    ensureDataDir();
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initSchema(db);
  }
  return db;
}

function initSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      cwd TEXT NOT NULL DEFAULT '',
      env TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_run_at TEXT,
      last_exit_code INTEGER
    );

    CREATE TABLE IF NOT EXISTS group_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'killed'))
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
      group_run_id INTEGER REFERENCES group_runs(id) ON DELETE SET NULL,
      pid INTEGER,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      exit_code INTEGER,
      status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'killed')),
      UNIQUE(id)
    );

    CREATE TABLE IF NOT EXISTS log_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      stream_type TEXT NOT NULL CHECK (stream_type IN ('stdout', 'stderr')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS group_commands (
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      command_id INTEGER NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (group_id, command_id)
    );

    CREATE INDEX IF NOT EXISTS idx_runs_command_id ON runs(command_id);
    CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
    CREATE INDEX IF NOT EXISTS idx_log_chunks_run_id ON log_chunks(run_id);
    CREATE INDEX IF NOT EXISTS idx_group_commands_group_id ON group_commands(group_id);
  `);
}

export type CommandRow = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
};

export type RunRow = {
  id: number;
  command_id: number;
  group_run_id: number | null;
  pid: number | null;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  status: string;
};

export type LogChunkRow = {
  id: number;
  run_id: number;
  stream_type: "stdout" | "stderr";
  content: string;
  created_at: string;
};

export type GroupRow = {
  id: number;
  name: string;
  created_at: string;
};

export type GroupCommandRow = {
  group_id: number;
  command_id: number;
  sort_order: number;
};

export type GroupRunRow = {
  id: number;
  group_id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
};
