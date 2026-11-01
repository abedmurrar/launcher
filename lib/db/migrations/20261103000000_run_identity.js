/**
 * Process identity and end reasons for runs.
 * - boot_id / pid_start_time: (pid, start time, boot) identify a run's process; a bare pid can be reused.
 * - end_reason: why a run ended (exited, failed, stopped, group_failed, signal:<NAME>, ended,
 *   launcher_down, reboot, spawn_failed).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE runs ADD COLUMN boot_id TEXT");
  await knex.raw("ALTER TABLE runs ADD COLUMN pid_start_time TEXT");
  await knex.raw("ALTER TABLE runs ADD COLUMN end_reason TEXT");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw("ALTER TABLE runs DROP COLUMN end_reason");
  await knex.raw("ALTER TABLE runs DROP COLUMN pid_start_time");
  await knex.raw("ALTER TABLE runs DROP COLUMN boot_id");
};
