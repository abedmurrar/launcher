/**
 * Factory for WebSocket message payloads sent to clients.
 */
export const WsMessageFactory = {
  commands(data: unknown): { type: "commands"; data: unknown } {
    return { type: "commands", data };
  },

  groups(data: unknown): { type: "groups"; data: unknown } {
    return { type: "groups", data };
  },

  log(
    runId: number,
    streamType: "stdout" | "stderr",
    content: string
  ): { type: "log"; runId: number; streamType: "stdout" | "stderr"; data: string } {
    return { type: "log", runId, streamType, data: content };
  },

  logHistory(
    runId: number,
    chunks: Array<{ stream_type: string; content: string }>
  ): { type: "log_history"; runId: number; chunks: Array<{ stream_type: string; content: string }> } {
    return { type: "log_history", runId, chunks };
  },

  logFinished(runId: number): { type: "log_finished"; runId: number } {
    return { type: "log_finished", runId };
  },
} as const;
