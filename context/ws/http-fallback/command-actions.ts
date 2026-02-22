import type { ActionResult } from "../types";
import type { OnListsUpdated } from "../adapters";
import { adaptResponseToActionResult } from "../adapters";
import { ActionResultFactory } from "@/lib/actions/result-factory";
import { apiClient } from "@/lib/api";

export async function runCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const res = await apiClient.post(`/api/commands/${commandId}/run`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function stopCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const params =
    payload.runId != null ? { params: { runId: payload.runId } } : {};
  const res = await apiClient.post(
    `/api/commands/${commandId}/stop`,
    undefined,
    params
  );
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function restartCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.commandId);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const res = await apiClient.post(`/api/commands/${commandId}/restart`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function createCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const res = await apiClient.post("/api/commands", (payload.data as object) ?? {});
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function updateCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.id);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const res = await apiClient.patch(
    `/api/commands/${commandId}`,
    (payload.data as object) ?? {}
  );
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function deleteCommandHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const commandId = Number(payload.id);
  if (Number.isNaN(commandId)) return ActionResultFactory.invalidId();

  const res = await apiClient.delete(`/api/commands/${commandId}`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}
