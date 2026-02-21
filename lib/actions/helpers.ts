import type { z } from "zod";
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
