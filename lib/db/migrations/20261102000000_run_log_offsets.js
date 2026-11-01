/**
 * Byte offsets into a run's stdout/stderr log files that have been ingested into log_chunks.
 * Updated in the same transaction as the chunk insert, so ingestion is exactly-once across restarts.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE runs ADD COLUMN stdout_offset INTEGER NOT NULL DEFAULT 0");
  await knex.raw("ALTER TABLE runs ADD COLUMN stderr_offset INTEGER NOT NULL DEFAULT 0");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw("ALTER TABLE runs DROP COLUMN stderr_offset");
  await knex.raw("ALTER TABLE runs DROP COLUMN stdout_offset");
};
