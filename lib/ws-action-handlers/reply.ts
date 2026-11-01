import type { ActionPayload } from "./types";

export function parseId(value: unknown): number {
  return Number(value);
}

export function parseOptionalRunId(payload: ActionPayload): number | undefined {
  const runId = payload.runId;
  if (runId == null) return undefined;
  return Number(runId);
}
