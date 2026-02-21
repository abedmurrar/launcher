import type { ActionResult } from "../types";
import type { OnListsUpdated } from "../adapters";
import { adaptResponseToActionResult } from "../adapters";
import { ActionResultFactory } from "@/lib/actions/result-factory";

const API_BASE = "";

export async function createGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const name =
    payload.name ??
    (payload.data as { name?: string })?.name ??
    "";

  const response = await fetch(`${API_BASE}/api/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function updateGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.id);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const name =
    (payload.data as { name?: string })?.name ?? payload.name ?? "";

  const response = await fetch(`${API_BASE}/api/groups/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function deleteGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.id);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const response = await fetch(`${API_BASE}/api/groups/${groupId}`, {
    method: "DELETE",
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function setGroupCommandsHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.id);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const requestBody =
    (payload.data as { commandIds?: number[] }) ?? {
      commandIds: payload.commandIds ?? [],
    };

  const response = await fetch(
    `${API_BASE}/api/groups/${groupId}/commands`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  );
  return adaptResponseToActionResult(response, onListsUpdated);
}

export async function runGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.groupId);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const response = await fetch(`${API_BASE}/api/groups/${groupId}/run`, {
    method: "POST",
  });
  return adaptResponseToActionResult(response, onListsUpdated);
}
