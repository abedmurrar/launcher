import type { ActionResult } from "../types";
import type { ActionSender, OnListsUpdated } from "./action-sender-types";

type FetchActionFn = (
  actionType: string,
  payload: Record<string, unknown>,
  onListsUpdated: OnListsUpdated
) => Promise<ActionResult>;

/**
 * Adapter: exposes HTTP fetch-based action execution as the ActionSender interface.
 */
export function createHttpActionSender(
  fetchAction: FetchActionFn,
  onListsUpdated: OnListsUpdated
): ActionSender {
  return (actionType: string, payload: Record<string, unknown>) =>
    fetchAction(actionType, payload, onListsUpdated);
}
