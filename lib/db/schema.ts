import type Database from "better-sqlite3";

export function initSchema(database: Database.Database): void {
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
