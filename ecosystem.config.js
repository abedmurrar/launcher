/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS config loaded by pm2 */
/**
 * PM2 process config. Start/replace with:
 *   pm2 start ecosystem.config.js && pm2 save
 * Apply env changes with:
 *   pm2 restart ecosystem.config.js --update-env && pm2 save
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "launcher",
      cwd: __dirname,
      // The compiled server (`yarn build` produces dist/server.cjs). Running node directly avoids
      // the npm + tsx wrapper processes (~120 MB) and runtime TypeScript transpiling.
      script: "dist/server.cjs",
      interpreter: "node",
      node_args: "--enable-source-maps",
      // Back off between crash restarts (100ms doubling, capped by PM2 at 15s) instead of
      // restarting in a tight loop that floods the logs.
      exp_backoff_restart_delay: 100,
      // Give the launcher time to flush logs and close the DB on restart/stop.
      kill_timeout: 8000,
      time: true,
      out_file: path.join(process.env.HOME || "", ".pm2/logs/launcher-out.log"),
      error_file: path.join(process.env.HOME || "", ".pm2/logs/launcher-error.log"),
      env: {
        NODE_ENV: "production",
        PORT: "9555",
        // Keep run logs for at most 7 days (the latest run of each command is always kept).
        LAUNCHER_LOG_RETAIN_DAYS: "7",
      },
    },
  ],
};
