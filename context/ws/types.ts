export interface CommandListItem {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  running: boolean;
  run_id?: number;
  last_run_id?: number;
  pid?: number;
  /** Git branch at cwd, if the directory is a git repo */
  git_branch?: string | null;
}

export interface GroupListItem {
  id: number;
  name: string;
  created_at: string;
  command_ids: number[];
  last_run?:
    | { id: number; started_at: string; finished_at: string | null; status: string }
    | undefined;
  running: boolean;
  running_group_run_id?: number;
}

export interface LogChunk {
  stream_type: string;
  content: string;
}

export interface LogCallbacks {
  onHistory?: (chunks: LogChunk[]) => void;
  onChunk: (streamType: "stdout" | "stderr", data: string) => void;
  onFinished: () => void;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface WsContextValue {
  commands: CommandListItem[];
  groups: GroupListItem[];
  ready: boolean;
  initialLoadDone: boolean;
  connectionError: boolean;
  sendAction: (type: string, payload: Record<string, unknown>) => Promise<ActionResult>;
  subscribeToLogs: (runId: number, callbacks: LogCallbacks) => void;
  unsubscribeFromLogs: (runId: number) => void;
}

export interface IncomingMessage {
  type: string;
  data?: unknown;
  runId?: number;
  streamType?: "stdout" | "stderr";
  requestId?: string;
  success?: boolean;
  error?: string;
  chunks?: LogChunk[];
}
