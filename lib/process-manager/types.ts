import type { ChildProcess } from "child_process";

export type RunRecord = {
  childProcess: ChildProcess;
  commandId: number;
  runId: number;
  groupRunId: number | null;
};

export type SSEWriter = (data: string, streamType: "stdout" | "stderr") => void;
