# Browser-based command launcher (XAMPP-style)

A local web app to define, run, stop, and restart shell commands and command groups. Logs are streamed live and persisted in SQLite.

**Stack:** Next.js 16 (App Router), React 19, Tailwind 4, TypeScript. Prefer **`interface`** for object shapes; use **`type`** for unions, function types, and generics.

> **Security:** This app is for **local use only** (e.g. `localhost`). Do not expose it to the network without adding authentication.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:9555](http://localhost:9555). After code changes, run `npm run dev` to verify the app and server still work.

---

## Build and run locally

**Prerequisites:** Node.js 18+ and npm.

| Step | Command | Description |
|------|---------|-------------|
| Install deps | `npm install` | Install dependencies. |
| Build | `npm run build` | Production build (Next.js + server). |
| Run (dev) | `npm run dev` | Dev server with Socket.IO at `http://localhost:9555` (or `PORT`); uses polling then WebSocket. |
| Run (prod) | `npm start` | Production server; requires `npm run build` first. |

- **Port:** Default is `9555`. Override with `PORT=1337 npm start` (or `npm run dev`).
- **Bind address:** Default is `127.0.0.1` (local only). The app runs arbitrary shell commands without auth, so LAN access is an explicit opt-in: `HOST=0.0.0.0 npm start`.
- **Tuning (optional env vars):**

  | Variable | Default | Meaning |
  |----------|---------|---------|
  | `LAUNCHER_STOP_GRACE_MS` | `5000` | Time between SIGTERM and SIGKILL when stopping a run. |
  | `LAUNCHER_LOG_FLUSH_MS` / `LAUNCHER_LOG_FLUSH_BYTES` | `100` / `65536` | Log output is buffered and written/broadcast in batches. |
  | `LAUNCHER_LOG_HISTORY_BYTES` | `2097152` | Max log history sent when opening a log viewer (full log via the logs API). |
  | `LAUNCHER_LOG_RETAIN_RUNS` | `20` | Keep logs for the newest N runs per command. |
  | `LAUNCHER_LOG_RETAIN_DAYS` | `30` | Also drop logs older than N days (`0` = no age limit). The latest run of each command is always kept. |
  | `LAUNCHER_LIST_DEBOUNCE_MS` | `150` | Coalesces command/group list broadcasts. |
  | `LAUNCHER_GIT_BRANCH_TTL_MS` | `10000` | Cache TTL for the git branch shown per command. |
- **Data:** SQLite DB and data dir are created at `./data/` under the **current working directory** when the app starts. Run the app from the project root so `data/launcher.db` lives in the repo (or set `cwd` when running as a daemon).

---

## Running as a daemon on Linux

To keep the launcher running in the background, start on boot, and restart on failure, see **[docs/daemon.md](docs/daemon.md)** (PM2 with nvm, systemd user service, and day-to-day commands).

Quick reference:

### Option 1: systemd user service (recommended)

Runs as your user; no root required.

1. **Build the app** (from the project directory):

   ```bash
   cd /path/to/launcher
   npm install
   npm run build
   ```

2. **Create a user systemd unit** (e.g. `~/.config/systemd/user/launcher.service`):

   ```ini
   [Unit]
   Description=Launcher (browser-based command runner)
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/path/to/launcher
   ExecStart=/usr/bin/env npm start
   Restart=on-failure
   RestartSec=5
   # Optional: port (default 9555)
   Environment=PORT=9555

   [Install]
   WantedBy=default.target
   ```

   Replace `/path/to/launcher` with the real path to the project (e.g. `/home/you/Dev/launcher`).

3. **Enable and start** (user service):

   ```bash
   systemctl --user daemon-reload
   systemctl --user enable launcher
   systemctl --user start launcher
   ```

4. **Useful commands:**

   ```bash
   systemctl --user status launcher   # status
   systemctl --user stop launcher     # stop
   systemctl --user restart launcher  # restart after code/build changes
   journalctl --user -u launcher -f  # follow logs
   ```

5. **Long-running without login:** If you want the service to run when no one is logged in (e.g. on a headless server), enable lingering for your user:

   ```bash
   loginctl enable-linger $USER
   ```

Then the user service will start at boot and keep running after you log out.

### Option 2: systemd system service

Runs as a system-wide service (requires root to install).

1. Create `/etc/systemd/system/launcher.service`:

   ```ini
   [Unit]
   Description=Launcher (browser-based command runner)
   After=network.target

   [Service]
   Type=simple
   User=youruser
   WorkingDirectory=/path/to/launcher
   ExecStart=/usr/bin/env npm start
   Restart=on-failure
   RestartSec=5
   Environment=PORT=9555

   [Install]
   WantedBy=multi-user.target
   ```

   Replace `youruser` and `/path/to/launcher` with the user that owns the app and the project path.

2. Enable and start:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable launcher
   sudo systemctl start launcher
   sudo systemctl status launcher
   ```

### Option 3: Process manager (e.g. PM2)

If you prefer PM2:

```bash
npm install -g pm2
cd /path/to/launcher
npm run build
pm2 start npm --name launcher -- start
pm2 save
pm2 startup   # optional: run the command it prints to start on boot
```

Logs: `pm2 logs launcher`. Restart: `pm2 restart launcher`.

---

## Architecture

- **Runtime:** All process spawning and SQLite run in **Node.js** (not Edge). Route Handlers use the default Node runtime; `child_process` and `better-sqlite3` are only used there.
- **Frontend data:** When you run the custom server (`npm run dev`), the UI uses **Socket.IO** for real-time list updates and actions (transports: polling, then WebSocket). If Socket.IO is unavailable, the client falls back to **HTTP** (fetch for lists and action endpoints).
- **Process tracking:** In-memory map `pid → { childProcess, commandId, runId }` in `lib/process-manager/state.ts` for stop/restart. After a server restart the map is empty; “stop” can still work by calling `process.kill(pid, 'SIGTERM')` using the PID stored in the DB for that run.
- **Log streaming:** Server-Sent Events (SSE) from Route Handlers: one stream per run. Stdout/stderr are streamed to the SSE response and appended to SQLite so logs are both live and persisted.
- **Group runs:** Commands in a group start **in parallel**. When any process exits with non-zero (or errors), the server kills all other processes in that group and marks the group run as failed.

```
┌─────────────────────────────────────────────────────────────────┐
│  Web UI: Commands │ Groups │ Log viewer                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Next.js API: CRUD (commands/groups) │ Run/Stop/Restart │ SSE   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Data: SQLite DB │ In-memory PID map                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Child processes (spawned by process manager)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data model (SQLite)

- **commands** — `id`, `name`, `command` (text), `cwd`, `env` (JSON), `created_at`, `updated_at`. Optional: `last_run_at`, `last_exit_code`.
- **runs** — `id`, `command_id`, `pid` (nullable until spawned), `started_at`, `finished_at`, `exit_code`, `status` (`running` | `success` | `failed` | `killed`). One row per execution.
- **log_chunks** — `id`, `run_id`, `stream_type` (`stdout` | `stderr`), `content`, `created_at`. Append-only.
- **groups** — `id`, `name`, `created_at`.
- **group_commands** — `group_id`, `command_id`, `sort_order`. Membership and display order; execution is parallel.
- **group_runs** — `id`, `group_id`, `started_at`, `finished_at`, `status`. Tracks group run for “all failed” behavior.

The DB file is created at `./data/launcher.db` (or as configured); `data/` is created if missing. Tables are created on app startup via a DB init module used by API routes.

---

## API (App Router Route Handlers)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/commands` | List commands (with last run info). |
| POST | `/api/commands` | Create command (body: `name`, `command`, `cwd`, `env`). |
| GET | `/api/commands/[id]` | One command + last run. |
| PATCH | `/api/commands/[id]` | Update command. |
| DELETE | `/api/commands/[id]` | Delete command. |
| POST | `/api/commands/[id]/run` | Start command; create run; spawn process; return `run_id`, `pid`. |
| POST | `/api/commands/[id]/stop` | Stop by `runId` or running run for command; kill via PID; update run. |
| POST | `/api/commands/[id]/restart` | Stop current run (if any) then start again. |
| GET | `/api/groups` | List groups with member command ids (and optional last group run). |
| POST | `/api/groups` | Create group (body: `name`). |
| PATCH | `/api/groups/[id]` | Update group name. |
| PUT | `/api/groups/[id]/commands` | Set members (body: `commandIds[]`). |
| DELETE | `/api/groups/[id]` | Delete group. |
| POST | `/api/groups/[id]/run` | Run all member commands in parallel; create group_run and runs; on first failure, kill others and set status. |
| GET | `/api/runs/[runId]/logs` | Fetch persisted log chunks: full, or `?before=<chunkId>&limit=<n>` to page backwards. |
| DELETE | `/api/runs/[runId]/logs` | Clear a run's log chunks. |

Live logs are streamed over Socket.IO (`subscribe_logs` → `log_history` tail, then `log_batch` events, then `log_finished`).

All handlers that use the DB or `child_process` live under `app/api/` and use the shared DB helper and process manager module.

---

## Process manager (server-side)

- **Spawn:** `spawn(command, args, { cwd, env: { ...process.env, ...commandEnv } })`. The `command` is parsed (e.g. shell for pipes/redirects); see “Open decisions” below.
- **PID map:** Store `run_id`, `command_id`, `ChildProcess`; on exit, update `runs` (finished_at, exit_code, status) and remove from map.
- **Group run:** For each command in the group, spawn and record run_id; on any non-zero exit, kill remaining processes for that group run and update all runs and group_run status.
- **Logging:** stdout/stderr are buffered per run and flushed every ~100 ms (or 64 KB) as one DB transaction plus one `log_batch` Socket.IO emit to the `run:<id>` room. Batches carry the last chunk id so clients de-duplicate against history.
- **Stopping:** SIGTERM to the process group, then SIGKILL after `LAUNCHER_STOP_GRACE_MS`; the result reports `forced: true` when SIGKILL was needed.
- **Concurrency:** partial unique indexes allow at most one running run per command and per group; actions on the same command/group are serialized.
- **Shared state:** process/socket/DB state lives on `globalThis` (`lib/global-singleton.ts`) so the custom server and Next route handlers share one instance.

---

## Frontend (React)

- **Layout:** Sidebar or tabs for Commands, Groups, and optionally “Running” (or show running state in Commands/Groups).
- **Commands:** List (name, command truncated, cwd, last run, status), actions: Run, Stop, Restart, Edit, Delete, View logs. “Add command” form: name, command, cwd, env (key/value or text area).
- **Groups:** List groups; create (name); edit: add/remove/reorder saved commands; Run group; show “running” and “one failed → all stopped”.
- **Running:** Show which commands are running (e.g. via `GET /api/commands` or `GET /api/runs?status=running`, or optional SSE).
- **Logs:** `useRunLogs(runId)` subscribes over Socket.IO, merges output into capped segments, flushes once per animation frame, and re-subscribes after reconnects. `LogPane` auto-scrolls only while you are at the bottom.

---

## Dependencies

| Package | Version | Usage |
|--------|---------|--------|
| **next** | 16.1.6 | App Router, Route Handlers in `app/api/`. Use Node runtime (default) for routes that use `child_process` or Knex. [Next.js 16 docs](https://nextjs.org/docs). |
| **react** / **react-dom** | 19.2.x | UI; use Server/Client Components as needed. |
| **knex** | ^3.1.0 | Query builder and migrations; SQLite via **better-sqlite3**. Single shared DB via `getDb()`; schema in `lib/db/migrations/`. [Knex](https://knexjs.org/guide/). |
| **better-sqlite3** | ^12.6.2 | SQLite driver used by Knex. [API](https://github.com/WiseLibs/better-sqlite3/blob/HEAD/docs/api.md). |
| **@types/better-sqlite3** | ^7.6.13 | TypeScript types for better-sqlite3. |
| **zod** | ^4.3.6 | Request body validation in Route Handlers: `z.object({ ... }).parse(await request.json())`. [zod](https://zod.dev). |
| **tailwindcss** / **@tailwindcss/postcss** | ^4.2.0 | Styling. [Tailwind v4](https://tailwindcss.com/docs). |

---

## Security and safety (local-only)

- Intended for **local use only**. The server binds to `127.0.0.1` by default; `HOST=0.0.0.0` exposes it (no auth).
- Validate `cwd` to prevent escaping (e.g. resolve to real path and ensure it’s under an allowed base).
- Sanitize or restrict `command` as needed; env vars from the DB are applied as-is.

---

## File structure

- **`lib/db/`** — `connection.ts`, **`migrations/`** (Knex), **`queries/`** (commands, groups, runs, group-commands, group-runs, log-chunks), `types.ts` (row **interfaces**), `knex-types.d.ts` (Knex table augmentation), `facade.ts`. Single shared DB via Knex; schema via migrations.
- **`lib/process-manager/`** — `state.ts` (static singleton), spawn, stop, kill, log, `facade.ts`. PID map, group run, log piping to DB and SSE.
- **`lib/actions/`** — command/group server actions, `result-factory.ts`, `facade.ts`. **`lib/ws-action-handlers/`** — `types.ts` (CommandAction, GroupAction enums), command/group handlers, reply.
- **`lib/ws-broadcast/`** — Socket.IO list push, log stream, message factory, clients.
- **`context/ws/`** — React context provider, adapters (action sender, lists fetcher), lists-update-subject, HTTP fallback for actions and initial load.
- **`app/api/`** — Route Handlers: `commands/`, `commands/[id]/`, run/stop/restart; `groups/`, `groups/[id]/`, commands, run; `runs/[runId]/logs/`, `runs/[runId]/logs/stream/`.
- **`app/page.tsx`** — single dashboard with tabs (Commands | Groups). `app/error.tsx`, `app/not-found.tsx`, `app/global-error.tsx`, `app/loading.tsx` for error and loading states.
- **Components:** `CommandList/` (useCommandList hook, container index, CommandListView), `GroupList/` (useGroupList, index, GroupListView), `CommandForm`, `GroupForm`, `LogViewer`, `RunControls`, `shared/ConnectionStatus`.

---

## Implementation order (from plan)

1. DB and schema — better-sqlite3, `lib/db.ts`, tables.
2. Commands CRUD API — commands and runs (create run row on start; update on exit).
3. Process manager — Spawn, PID map, stdout/stderr → DB; wire run/stop/restart to API.
4. Log streaming — SSE endpoint; persist chunks in process manager.
5. Groups API and group run — Parallel start; on first failure kill all; update runs and group_runs.
6. Frontend — Commands list/form, run/stop/restart, last run and running state, log viewer.
7. Frontend groups — Group list, create/edit, run group, group run status.
8. Env vars — Ensure form and API pass `env` through to spawn.
9. Polish — Validation (e.g. zod), error messages, loading states, confirm stop/restart.

---

## Open decisions

- **Command parsing:** Use `child_process.spawn` with first token as executable and rest as args, or run in a shell (`sh -c '...'`) for pipes/redirects. Shell is more flexible; recommend shell for this launcher and document the choice.
- **Log chunk size:** Append per `data` event vs buffering (e.g. 4KB); per-event is simpler to start with.
- **DB file location:** e.g. `./data/launcher.db` under project root; create `data/` if missing.
