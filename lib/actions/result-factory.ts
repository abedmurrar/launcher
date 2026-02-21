import type { OkResult, ErrResult } from "./types";

/**
 * Factory for action result objects (success and error shapes).
 */
export const ActionResultFactory = {
  success<T = void>(data?: T): OkResult<T> {
    return { success: true, ...(data !== undefined ? { data } : {}) };
  },

  error(message: string, code?: number): ErrResult {
    return { success: false, error: message, ...(code !== undefined ? { code } : {}) };
  },

  invalidId(): ErrResult {
    return ActionResultFactory.error("Invalid id", 400);
  },

  notFound(resource: string): ErrResult {
    return ActionResultFactory.error(`${resource} not found`, 404);
  },
} as const;
