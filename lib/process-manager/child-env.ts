import { globalSingleton } from "@/lib/global-singleton";

/**
 * Environment for managed commands.
 *
 * Commands should see the user's environment, not the launcher's own runtime state. When the
 * launcher runs as a production build under PM2/npm, its process.env also contains values that
 * break or slow down dev tooling in the commands it starts, e.g.:
 *  - NODE_ENV=production   → webpack/Next/Vite dev servers rebuild in production mode (minifying
 *                            on every change), `npm/yarn install` skips devDependencies
 *  - PORT / HOST           → dev servers try to bind the launcher's own port
 *  - TURBOPACK, NEXT_*     → set by the launcher's Next.js runtime; change child Next.js apps
 *  - npm_*, INIT_CWD       → npm lifecycle state of `npm start`
 *  - pm_id, NODE_APP_INSTANCE, status, … → PM2 bookkeeping (`config` uses NODE_APP_INSTANCE)
 * A command can still set any of these explicitly through its own env settings.
 */

const STRIP_EXACT = new Set([
  "NODE_ENV",
  "PORT",
  "HOST",
  "INIT_CWD",
  "TURBOPACK",
  "NEXT_RUNTIME",
  "NEXT_DEPLOYMENT_ID",
]);

const STRIP_PREFIXES = ["LAUNCHER_", "npm_", "__NEXT", "NEXT_PRIVATE_", "__TURBOPACK"];

/** Keys PM2 injects into the app's environment (only stripped when running under PM2). */
const PM2_KEYS = new Set([
  "pm_id",
  "name",
  "namespace",
  "status",
  "NODE_APP_INSTANCE",
  "unique_id",
  "instances",
  "instance_var",
  "exec_mode",
  "exec_interpreter",
  "autorestart",
  "autostart",
  "treekill",
  "kill_timeout",
  "kill_retry_time",
  "restart_time",
  "unstable_restarts",
  "created_at",
  "pmx",
  "vizion",
  "vizion_running",
  "km_link",
  "merge_logs",
  "log_date_format",
  "time",
  "windowsHide",
  "username",
  "exp_backoff_restart_delay",
  "automation",
  "cwd",
  "PM2_USAGE",
  "PM2_JSON_PROCESSING",
]);
const PM2_PREFIXES = ["pm_", "axm_"];

export function sanitizeEnv(env: Record<string, string | undefined>): Record<string, string> {
  const underPm2 = env.pm_id !== undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (STRIP_EXACT.has(key) || STRIP_PREFIXES.some((p) => key.startsWith(p))) continue;
    if (underPm2 && (PM2_KEYS.has(key) || PM2_PREFIXES.some((p) => key.startsWith(p)))) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Snapshot of the launcher's environment taken as early as possible (before Next.js adds its
 * runtime variables). Call captureBaseEnv() at server startup; getChildBaseEnv() falls back to
 * the current environment if it was never captured (e.g. in tests).
 */
const snapshot = globalSingleton("child-base-env", () => ({ env: null as Record<string, string> | null }));

export function captureBaseEnv(): void {
  if (snapshot.env === null) snapshot.env = sanitizeEnv(process.env);
}

export function getChildBaseEnv(): Record<string, string> {
  return { ...(snapshot.env ?? sanitizeEnv(process.env)) };
}

/** Base environment + the command's own env (command settings win). */
export function buildChildEnv(commandEnv: Record<string, string>): Record<string, string> {
  return { ...getChildBaseEnv(), ...commandEnv };
}
