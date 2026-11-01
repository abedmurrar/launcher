import {
  clearRestoreOffers,
  deleteRestoreOffer,
  getRecentRunDurations,
  listRestoreOffers,
} from "@/lib/db/queries";
import { scheduleListsBroadcast } from "@/lib/ws-broadcast";
import type { ActionResult } from "./types";
import { ActionResultFactory } from "./result-factory";
import { runCommand } from "./commands";
import { runGroup } from "./groups";

export interface RestoreOffer {
  id: number;
  kind: "command" | "group";
  targetId: number;
  name: string;
  /** "reboot" | "launcher_down" */
  reason: string;
  autoRestart: boolean;
}

export async function getRestoreOffers(): Promise<RestoreOffer[]> {
  const rows = await listRestoreOffers();
  return rows.map((r) => ({
    id: r.id,
    kind: r.command_id != null ? "command" : "group",
    targetId: (r.command_id ?? r.group_id)!,
    name: r.name,
    reason: r.reason,
    autoRestart: Boolean(r.auto_restart),
  }));
}

async function restoreOne(offer: RestoreOffer): Promise<ActionResult<unknown>> {
  return offer.kind === "command" ? runCommand(offer.targetId) : runGroup(offer.targetId);
}

/** Start everything that was running before the reboot / launcher crash. */
export async function restoreAll(): Promise<ActionResult<{ restored: number; failed: string[] }>> {
  const offers = await getRestoreOffers();
  let restored = 0;
  const failed: string[] = [];
  for (const offer of offers) {
    const result = await restoreOne(offer);
    // "Already running" (409) also means it's back: drop the offer.
    if (result.success || result.code === 409) {
      restored++;
      await deleteRestoreOffer(offer.id);
    } else {
      failed.push(`${offer.name}: ${result.error}`);
    }
  }
  scheduleListsBroadcast();
  return ActionResultFactory.success({ restored, failed });
}

export async function dismissRestore(): Promise<ActionResult<{ ok: true }>> {
  await clearRestoreOffers();
  scheduleListsBroadcast();
  return ActionResultFactory.success({ ok: true as const });
}

/** Crash-loop guard: its last 3 runs each lasted under 10s (and weren't stopped by the user). */
const LOOP_RUNS = 3;
const LOOP_SECONDS = 10;

async function isCrashLooping(commandId: number): Promise<boolean> {
  const recent = await getRecentRunDurations(commandId, LOOP_RUNS);
  return (
    recent.length >= LOOP_RUNS &&
    recent.every((r) => r.seconds != null && r.seconds < LOOP_SECONDS && r.end_reason !== "stopped")
  );
}

/**
 * After startup reconciliation: restart offered commands that have auto-restart enabled.
 * Commands that look crash-looping are left in the offer list for the user to decide.
 */
export async function autoRestartAfterStartup(): Promise<{ restarted: string[]; skipped: string[] }> {
  const restarted: string[] = [];
  const skipped: string[] = [];
  for (const offer of await getRestoreOffers()) {
    if (offer.kind !== "command" || !offer.autoRestart) continue;
    if (await isCrashLooping(offer.targetId)) {
      skipped.push(offer.name);
      continue;
    }
    const result = await runCommand(offer.targetId);
    if (result.success || result.code === 409) {
      restarted.push(offer.name);
      await deleteRestoreOffer(offer.id);
    } else {
      skipped.push(offer.name);
    }
  }
  if (restarted.length || skipped.length) scheduleListsBroadcast();
  return { restarted, skipped };
}
