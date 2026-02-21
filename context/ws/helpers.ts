import type { IncomingMessage } from "./types";

export function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function parseMessage(event: MessageEvent): IncomingMessage | null {
  try {
    return JSON.parse(event.data as string) as IncomingMessage;
  } catch {
    return null;
  }
}

export function isActionResultMessage(message: IncomingMessage): boolean {
  return (
    typeof message.type === "string" &&
    message.type.endsWith("_result") &&
    typeof message.requestId === "string"
  );
}
