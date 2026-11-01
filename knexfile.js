/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config loaded by the knex CLI */
const path = require("path");

// Use cwd so the DB path is consistent regardless of where knexfile is required from (e.g. Next bundling)
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "launcher.db");

/**
 * Per-connection pragmas. foreign_keys must be set on every connection or the
 * ON DELETE CASCADE clauses in the schema are silently ignored.
 */
function afterCreate(conn, done) {
  try {
    conn.pragma("journal_mode = WAL");
    conn.pragma("synchronous = NORMAL");
    conn.pragma("foreign_keys = ON");
    conn.pragma("busy_timeout = 5000");
    done(null, conn);
  } catch (err) {
    done(err, conn);
  }
}

const base = {
  client: "better-sqlite3",
  connection: { filename: DB_PATH },
  useNullAsDefault: true,
  pool: { min: 1, max: 1, afterCreate },
  migrations: {
    directory: path.join(process.cwd(), "lib", "db", "migrations"),
    tableName: "knex_migrations",
  },
};

/** @type { Object.<string, import("knex").Knex.Config> } */
module.exports = {
  development: base,
  production: base,
};
