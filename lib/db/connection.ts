import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { initSchema } from "./schema";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "launcher.db");

/**
 * Singleton: single shared database connection per process.
 */
class DbSingleton {
  private static instance: DbSingleton | null = null;
  private connection: Database.Database | null = null;

  private constructor() {}

  static getInstance(): DbSingleton {
    if (DbSingleton.instance === null) {
      DbSingleton.instance = new DbSingleton();
    }
    return DbSingleton.instance;
  }

  getConnection(): Database.Database {
    if (this.connection === null) {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      this.connection = new Database(DB_PATH);
      this.connection.pragma("journal_mode = WAL");
      initSchema(this.connection);
    }
    return this.connection;
  }
}

export function getDb(): Database.Database {
  return DbSingleton.getInstance().getConnection();
}
