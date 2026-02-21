import { z } from "zod";

export type OkResult<T = void> = { success: true; data?: T };
export type ErrResult = { success: false; error: string; code?: number };
export type ActionResult<T = void> = OkResult<T> | ErrResult;

export const createCommandSchema = z.object({
  name: z.string().min(1),
  command: z.string().min(1),
  cwd: z.string().default(""),
  env: z.record(z.string(), z.string()).default({}),
});

export const updateCommandSchema = z.object({
  name: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const createGroupSchema = z.object({ name: z.string().min(1) });
export const updateGroupSchema = z.object({ name: z.string().min(1) });
export const setGroupCommandsSchema = z.object({ commandIds: z.array(z.number()) });
