import type { IncomingMessage } from "./types";

export function isActionResultMessage(message: IncomingMessage): boolean {
  return (
    typeof message.type === "string" &&
    (message.type === "action_result" || message.type.endsWith("_result")) &&
    typeof message.requestId === "string"
  );
}
