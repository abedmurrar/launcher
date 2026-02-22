import { getDb } from "./connection";

/**
 * Facade: single entry point for database access.
 */
export const db = {
  get: getDb,
} as const;
