import type { ActionResult } from "../types";
import type { OnListsUpdated } from "./action-sender-types";
import { refetchLists } from "../refetch-lists";
import { ActionResultFactory } from "@/lib/actions/result-factory";

/**
 * Adapter: converts a fetch Response into ActionResult and triggers list refetch on success.
 */
export async function adaptResponseToActionResult(
  response: Response,
  onListsUpdated: OnListsUpdated
): Promise<ActionResult> {
  const data = response.ok
    ? await response.json().catch(() => null)
    : null;
  if (!response.ok) {
    return ActionResultFactory.error(
      (data?.error as string) ?? "Failed"
    );
  }
  await refetchLists(onListsUpdated);
  return ActionResultFactory.success(data);
}
