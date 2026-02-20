# Browser-based command launcher (XAMPP-style)

A local web app to define, run, stop, and restart shell commands and command groups. Logs are streamed live and persisted in SQLite.

**Stack:** Next.js 16 (App Router), React 19, Tailwind 4, TypeScript.

> **Security:** This app is for **local use only** (e.g. `localhost`). Do not expose it to the network without adding authentication.

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Build:** `npm run build`
- **Start (production):** `npm start`

---

## Architecture

- **Runtime:** All process spawning and SQLite run in **Node.js** (not Edge). Route Handlers use the default Node runtime; `child_process` and `better-sqlite3` are only used there.
- **Process tracking:** In-memory map `pid → { childProcess, commandId, runId }` for stop/restart. After a server restart the map is empty; “stop” can still work by calling `process.kill(pid, 'SIGTERM')` using the PID stored in the DB for that run.
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
| GET | `/api/runs/[runId]/logs` | Fetch persisted log chunks (paginated or full). |
| GET | `/api/runs/[runId]/logs/stream` | SSE stream for that run; pipe stdout/stderr to SSE and append to `log_chunks`; optional “run finished” event. |

All handlers that use the DB or `child_process` live under `app/api/` and use the shared DB helper and process manager module.

---

## Process manager (server-side)

- **Spawn:** `spawn(command, args, { cwd, env: { ...process.env, ...commandEnv } })`. The `command` is parsed (e.g. shell for pipes/redirects); see “Open decisions” below.
- **PID map:** Store `run_id`, `command_id`, `ChildProcess`; on exit, update `runs` (finished_at, exit_code, status) and remove from map.
- **Group run:** For each command in the group, spawn and record run_id; on any non-zero exit, kill remaining processes for that group run and update all runs and group_run status.
- **Logging:** On each stdout/stderr `data` event, (1) append a row to `log_chunks`, (2) if there’s an active SSE writer for that run_id, write the chunk. Use a map `runId → writer[]` so multiple clients can subscribe to the same run.

---

## Frontend (React)

- **Layout:** Sidebar or tabs for Commands, Groups, and optionally “Running” (or show running state in Commands/Groups).
- **Commands:** List (name, command truncated, cwd, last run, status), actions: Run, Stop, Restart, Edit, Delete, View logs. “Add command” form: name, command, cwd, env (key/value or text area).
- **Groups:** List groups; create (name); edit: add/remove/reorder saved commands; Run group; show “running” and “one failed → all stopped”.
- **Running:** Show which commands are running (e.g. via `GET /api/commands` or `GET /api/runs?status=running`, or optional SSE).
- **Logs:** For a run, open SSE to `GET /api/runs/[runId]/logs/stream` and append to a log viewer; when finished, allow viewing from DB via `GET /api/runs/[runId]/logs`.

---

## Dependencies

| Package | Version | Usage |
|--------|---------|--------|
| **next** | 16.1.6 | App Router, Route Handlers in `app/api/`. Use Node runtime (default) for routes that use `child_process` or `better-sqlite3`. [Next.js 16 docs](https://nextjs.org/docs). |
| **react** / **react-dom** | 19.2.x | UI; use Server/Client Components as needed. |
| **better-sqlite3** | ^12.6.2 | Synchronous SQLite in API routes. Use a single shared DB instance (e.g. in `lib/db.ts`); `db.prepare('...').run()` / `.get()` / `.all()`. [better-sqlite3](https://github.com/WiseLibs/better-sqlite3). |
| **@types/better-sqlite3** | ^7.6.13 | TypeScript types for better-sqlite3. |
| **zod** | ^4.3.6 | Request body validation in Route Handlers: `z.object({ ... }).parse(await request.json())`. [zod](https://zod.dev). |
| **tailwindcss** / **@tailwindcss/postcss** | ^4.2.0 | Styling. [Tailwind v4](https://tailwindcss.com/docs). |

SSE uses native `TransformStream` and `Response` with `text/event-stream` (no extra package).

---

## Security and safety (local-only)

- Intended for **local use only** (e.g. `localhost`). No auth in scope by default.
- Validate `cwd` to prevent escaping (e.g. resolve to real path and ensure it’s under an allowed base).
- Sanitize or restrict `command` as needed; env vars from the DB are applied as-is.

---

## File structure

- `lib/db.ts` — SQLite connection, schema init, migrations.
- `lib/process-manager.ts` — spawn, PID map, group run, log piping to DB and SSE.
- `app/api/commands/` — `route.ts`, `[id]/route.ts`, `[id]/run/route.ts`, `[id]/stop/route.ts`, `[id]/restart/route.ts`.
- `app/api/groups/` — `route.ts`, `[id]/route.ts`, `[id]/run/route.ts`, `[id]/commands/route.ts`.
- `app/api/runs/[runId]/logs/route.ts`, `app/api/runs/[runId]/logs/stream/route.ts`.
- `app/page.tsx` — dashboard (commands + groups + running).
- `app/commands/page.tsx` (or dashboard sections) — command list and form.
- `app/groups/page.tsx` — group list and edit.
- Components: CommandForm, CommandList, GroupForm, GroupList, LogViewer (SSE + fetch), RunControls (Run/Stop/Restart).

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
