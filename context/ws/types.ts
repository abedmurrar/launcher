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
  last_run_status?: string;
  last_end_reason?: string;
  auto_restart?: boolean;
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

export interface RestoreOffer {
  id: number;
  kind: "command" | "group";
  targetId: number;
  name: string;
  /** "reboot" | "launcher_down" */
  reason: string;
  autoRestart: boolean;
}

export interface LiveLogChunk {
  streamType: "stdout" | "stderr";
  data: string;
}

export interface LogHistoryMeta {
  /** Older output exists that was not sent (only the tail is sent). */
  truncated: boolean;
  /** DB id of the newest chunk in the history (0 if none). */
  lastId: number;
  /** DB id of the oldest chunk in the history (0 if none). */
  firstId: number;
  /** Whether the run is still running. */
  live: boolean;
}

export interface LogCallbacks {
  /** Persisted tail of the log; sent on every (re)subscribe and replaces prior content. */
  onHistory?: (chunks: LogChunk[], meta: LogHistoryMeta) => void;
  /** Live output. `lastId` is the DB id of the batch's last chunk (undefined if it wasn't persisted). */
  onBatch: (chunks: LiveLogChunk[], lastId: number | undefined) => void;
  onFinished: () => void;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  code?: number;
}

export interface WsContextValue {
  commands: CommandListItem[];
  groups: GroupListItem[];
  ready: boolean;
  initialLoadDone: boolean;
  connectionError: boolean;
  /** Things that were running before a reboot / launcher crash, offered for restore. */
  restoreOffers: RestoreOffer[];
  /** Changes when the launcher restarts. */
  instanceId: string | null;
  /** When the lists were last received from the server (ms epoch), 0 = never. */
  lastSyncAt: number;
  sendAction: (type: string, payload: Record<string, unknown>) => Promise<ActionResult>;
  subscribeToLogs: (runId: number, callbacks: LogCallbacks) => void;
  unsubscribeFromLogs: (runId: number) => void;
}

export type IncomingMessage =
  | { type: "commands"; data: unknown }
  | { type: "groups"; data: unknown }
  | {
      type: "log_history";
      runId?: number;
      chunks?: LogChunk[];
      truncated?: boolean;
      lastId?: number;
      firstId?: number;
      live?: boolean;
    }
  | { type: "log_batch"; runId?: number; chunks?: LiveLogChunk[]; lastId?: number }
  | { type: "log_finished"; runId?: number }
  | { type: "restore_offers"; data: unknown }
  | { type: "hello"; instanceId?: string };
