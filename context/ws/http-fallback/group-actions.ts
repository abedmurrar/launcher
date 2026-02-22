import type { ActionResult } from "../types";
import type { OnListsUpdated } from "../adapters";
import { adaptResponseToActionResult } from "../adapters";
import { ActionResultFactory } from "@/lib/actions/result-factory";
import { apiClient } from "@/lib/api";

export async function createGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const name =
    payload.name ??
    (payload.data as { name?: string })?.name ??
    "";

  const res = await apiClient.post("/api/groups", { name });
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function updateGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.id);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const name =
    (payload.data as { name?: string })?.name ?? payload.name ?? "";

  const res = await apiClient.patch(`/api/groups/${groupId}`, { name });
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function deleteGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.id);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const res = await apiClient.delete(`/api/groups/${groupId}`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
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

  const res = await apiClient.put(
    `/api/groups/${groupId}/commands`,
    requestBody
  );
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function runGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.groupId);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const res = await apiClient.post(`/api/groups/${groupId}/run`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function stopGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.groupId);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const res = await apiClient.post(`/api/groups/${groupId}/stop`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}

export async function restartGroupHttp(
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const groupId = Number(payload.groupId);
  if (Number.isNaN(groupId)) return ActionResultFactory.invalidId();

  const res = await apiClient.post(`/api/groups/${groupId}/restart`);
  return adaptResponseToActionResult(
    { data: res.data, status: res.status },
    onListsUpdated
  );
}
