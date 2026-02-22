const path = require("path");

// Use cwd so the DB path is consistent regardless of where knexfile is required from (e.g. Next bundling)
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "launcher.db");

/** @type { Object.<string, import("knex").Knex.Config> } */
module.exports = {
  development: {
    client: "better-sqlite3",
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(process.cwd(), "lib", "db", "migrations"),
      tableName: "knex_migrations",
    },
  },

  production: {
    client: "better-sqlite3",
    connection: { filename: DB_PATH },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(process.cwd(), "lib", "db", "migrations"),
      tableName: "knex_migrations",
    },
  },
};
