/**
 * - commands.auto_restart: restart automatically after a reboot / launcher crash.
 * - restore_offers: what was running when the machine rebooted or the launcher went down,
 *   offered for one-click restore. One row per command or group.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  await knex.raw("ALTER TABLE commands ADD COLUMN auto_restart INTEGER NOT NULL DEFAULT 0");
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS restore_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id INTEGER REFERENCES commands(id) ON DELETE CASCADE,
      group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK ((command_id IS NULL) <> (group_id IS NULL))
    )
  `);
  await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS ux_restore_offers_command ON restore_offers(command_id) WHERE command_id IS NOT NULL");
  await knex.raw("CREATE UNIQUE INDEX IF NOT EXISTS ux_restore_offers_group ON restore_offers(group_id) WHERE group_id IS NOT NULL");
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  await knex.raw("DROP TABLE IF EXISTS restore_offers");
  await knex.raw("ALTER TABLE commands DROP COLUMN auto_restart");
};
