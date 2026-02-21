import type { ActionResult } from "../types";
import type { OnListsUpdated } from "../adapters";
import { adaptResponseToActionResult } from "../adapters";
import { ActionResultFactory } from "@/lib/actions/result-factory";

const API_BASE = "";

export async function runCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const response = await fetch(`${API_BASE}/api/commands/${commandId}/run`, {
    method: "POST",
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function stopCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const runIdQuery =
    payload.runId != null ? `?runId=${String(payload.runId)}` : "";
  const url = `${API_BASE}/api/commands/${commandId}/stop${runIdQuery}`;
  const response = await fetch(url, { method: "POST" });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function restartCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const response = await fetch(
    `${API_BASE}/api/commands/${commandId}/restart`,
    { method: "POST" }
  );
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function createCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const response = await fetch(`${API_BASE}/api/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify((payload.data as object) ?? {}),
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function updateCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.id);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const response = await fetch(`${API_BASE}/api/commands/${commandId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify((payload.data as object) ?? {}),
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function deleteCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.id);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const response = await fetch(`${API_BASE}/api/commands/${commandId}`, {
    method: "DELETE",
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}
