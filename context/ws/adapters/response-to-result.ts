import type { ActionResult } from "../types";
import type { OnListsUpdated } from "./action-sender-types";
import { refetchLists } from "../refetch-lists";
import { ActionResultFactory } from "@/lib/actions/result-factory";

interface ApiResponseShape {
  data: unknown;
  status: number;
}

/**
 * Adapter: converts an API response (axios-style) into ActionResult and triggers list refetch on success.
 */
export async function adaptResponseToActionResult(
  response: ApiResponseShape,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const { data, status } = response;
  const ok = status >= 200 && status < 300;

  if (!ok) {
    const errorMessage =
      (data as { error?: string })?.error ?? "Request failed";
    return ActionResultFactory.error(errorMessage, status);
  }

  await refetchLists(onListsUpdated);
  return ActionResultFactory.success(data as Record<string, unknown>);
}
