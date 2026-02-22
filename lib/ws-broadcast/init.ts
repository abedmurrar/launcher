import { subscribeRunStateChange, subscribeLogEvents } from "@/lib/process-manager";
import { onRunStateChange } from "./lists";
import { pushLogChunk, pushLogFinished } from "./log-stream";

export function init(): void {
  subscribeRunStateChange(() => void onRunStateChange().catch((err) => console.error("[ws] onRunStateChange failed:", err)));
  subscribeLogEvents({
    onChunk: pushLogChunk,
    onFinished: pushLogFinished,
  });
}
