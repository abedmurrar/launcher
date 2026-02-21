import { subscribeRunStateChange, subscribeLogEvents } from "@/lib/process-manager";
import { onRunStateChange } from "./lists";
import { pushLogChunk, pushLogFinished } from "./log-stream";

export function init(): void {
  subscribeRunStateChange(onRunStateChange);
  subscribeLogEvents({
    onChunk: pushLogChunk,
    onFinished: pushLogFinished,
  });
}
