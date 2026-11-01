/**
 * - Clean up rows orphaned while foreign_keys was OFF (cascades never fired).
 * - Enforce "at most one running run per command / group" at the DB level.
 * - Add indexes for list-building and log queries.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Orphans
  await knex.raw("DELETE FROM group_commands WHERE group_id NOT IN (SELECT id FROM groups) OR command_id NOT IN (SELECT id FROM commands)");
  await knex.raw("DELETE FROM group_runs WHERE group_id NOT IN (SELECT id FROM groups)");
  await knex.raw("DELETE FROM runs WHERE command_id NOT IN (SELECT id FROM commands)");
  await knex.raw("UPDATE runs SET group_run_id = NULL WHERE group_run_id IS NOT NULL AND group_run_id NOT IN (SELECT id FROM group_runs)");
  await knex.raw("DELETE FROM log_chunks WHERE run_id NOT IN (SELECT id FROM runs)");

  // Duplicate "running" rows would violate the partial unique indexes below; keep the newest.
  await knex.raw(`
    UPDATE runs SET status = 'killed', finished_at = COALESCE(finished_at, datetime('now'))
    WHERE status = 'running'
      AND id NOT IN (SELECT MAX(id) FROM runs WHERE status = 'running' GROUP BY command_id)
  `);
  await knex.raw(`
    UPDATE group_runs SET status = 'killed', finished_at = COALESCE(finished_at, datetime('now'))
    WHERE status = 'running'
      AND id NOT IN (SELECT MAX(id) FROM group_runs WHERE status = 'running' GROUP BY group_id)
  `);

  await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS ux_runs_running_command ON runs(command_id) WHERE status = 'running'");
  await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS ux_group_runs_running_group ON group_runs(group_id) WHERE status = 'running'");

  await knex.raw("CREATE INDEX IF NOT EXISTS idx_runs_command_started ON runs(command_id, started_at)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_runs_group_run_id ON runs(group_run_id)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_group_runs_group_started ON group_runs(group_id, started_at)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_group_runs_status ON group_runs(status)");
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_log_chunks_run_id_id ON log_chunks(run_id, id)");
  // Superseded by idx_log_chunks_run_id_id
  await knex.raw("DROP INDEX IF EXISTS idx_log_chunks_run_id");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw("CREATE INDEX IF NOT EXISTS idx_log_chunks_run_id ON log_chunks(run_id)");
  await knex.raw("DROP INDEX IF EXISTS idx_log_chunks_run_id_id");
  await knex.raw("DROP INDEX IF EXISTS idx_group_runs_status");
  await knex.raw("DROP INDEX IF EXISTS idx_group_runs_group_started");
  await knex.raw("DROP INDEX IF EXISTS idx_runs_group_run_id");
  await knex.raw("DROP INDEX IF EXISTS idx_runs_command_started");
  await knex.raw("DROP INDEX IF EXISTS ux_group_runs_running_group");
  await knex.raw("DROP INDEX IF EXISTS ux_runs_running_command");
};
