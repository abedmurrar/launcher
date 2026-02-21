export type CommandRow = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: string;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
};

export type RunRow = {
  id: number;
  command_id: number;
  group_run_id: number | null;
  pid: number | null;
  started_at: string;
  finished_at: string | null;
  exit_code: number | null;
  status: string;
};

export type LogChunkRow = {
  id: number;
  run_id: number;
  stream_type: "stdout" | "stderr";
  content: string;
  created_at: string;
};

export type GroupRow = {
  id: number;
  name: string;
  created_at: string;
};

export type GroupCommandRow = {
  group_id: number;
  command_id: number;
  sort_order: number;
};

export type GroupRunRow = {
  id: number;
  group_id: number;
  started_at: string;
  finished_at: string | null;
  status: string;
};
