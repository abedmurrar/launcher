import type { z } from "zod";
import { globalSingleton } from "@/lib/global-singleton";
import type { ErrResult } from "./types";
import { ActionResultFactory } from "./result-factory";

export function formatValidationError(error: z.ZodError): string {
  const err = error as { message?: string; issues?: Array<{ message?: string }> };
  return err.issues?.map((e) => e.message).join("; ") ?? err.message ?? "Validation failed";
}

export function parseEnv(envJson: string | undefined): Record<string, string> {
  if (!envJson || typeof envJson !== "string") return {};
  try {
    return JSON.parse(envJson) as Record<string, string>;
  } catch {
    return {};
  }
}

export function invalidId(): ErrResult {
  return ActionResultFactory.invalidId();
}

export function notFound(resource: string): ErrResult {
  return ActionResultFactory.notFound(resource);
}

const locks = globalSingleton("action-locks", () => new Map<string, Promise<unknown>>());

/**
 * Serialize async work per key (e.g. "command:3") so concurrent run/stop/restart
 * requests for the same target can't interleave.
 */
export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return next;
}

function sqliteCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

export function isUniqueViolation(err: unknown): boolean {
  const code = sqliteCode(err);
  return code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY";
}

export function isForeignKeyViolation(err: unknown): boolean {
  return sqliteCode(err) === "SQLITE_CONSTRAINT_FOREIGNKEY";
}
