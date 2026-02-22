import type { Knex } from "knex";
import type { CommandRow, GroupRow, GroupCommandRow, GroupRunRow, RunRow, LogChunkRow } from "./types";

/** Update payload: optional fields, each value can be Raw (e.g. datetime('now')). */
type UpdatePayload<T> = { [K in keyof T]?: T[K] | Knex.Raw };

declare module "knex/types/tables" {
  interface Tables {
    commands: Knex.CompositeTableType<
      CommandRow,
      Pick<CommandRow, "name" | "command" | "cwd" | "env"> & Partial<Pick<CommandRow, "created_at" | "updated_at" | "last_run_at" | "last_exit_code">>,
      UpdatePayload<Omit<CommandRow, "id">>
    >;
    groups: Knex.CompositeTableType<
      GroupRow,
      Pick<GroupRow, "name"> & Partial<Pick<GroupRow, "created_at">>,
      UpdatePayload<Omit<GroupRow, "id">>
    >;
    group_commands: GroupCommandRow;
    group_runs: Knex.CompositeTableType<
      GroupRunRow,
      Pick<GroupRunRow, "group_id" | "status"> & Partial<Pick<GroupRunRow, "started_at" | "finished_at">>,
      UpdatePayload<Omit<GroupRunRow, "id">>
    >;
    runs: Knex.CompositeTableType<
      RunRow,
      Pick<RunRow, "command_id" | "status"> & Partial<Pick<RunRow, "group_run_id" | "pid" | "started_at" | "finished_at" | "exit_code">>,
      UpdatePayload<Omit<RunRow, "id">>
    >;
    log_chunks: Knex.CompositeTableType<
      LogChunkRow,
      Pick<LogChunkRow, "run_id" | "stream_type" | "content"> & { created_at?: string | Knex.Raw },
      UpdatePayload<Omit<LogChunkRow, "id">>
    >;
  }
}
