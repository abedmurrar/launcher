// Must be the first import: snapshots the environment managed commands inherit (see child-env.ts).
import "./capture-env";
import http from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getDb, closeDb } from "../lib/db/connection";
import { startSupervisor, stopSupervisor, flushAllLogs, stopAllTailing } from "../lib/process-manager";
import { acquireInstanceLock, releaseInstanceLock, InstanceLockError } from "../lib/instance-lock";
import { init } from "../lib/ws-broadcast";
import { startLogRetention } from "../lib/log-retention";
import { autoRestartAfterStartup } from "../lib/actions/restore";
import { handleSocketConnection } from "./ws-handler";
import { getAuthToken, unsafeBindingError } from "../lib/auth";
import { applySocketAuth, rejectUnauthorized } from "./auth";
import { dev, host, port, SOCKET_IO_PATH } from "./config";

// Log but don't exit: crashing would orphan every managed process' log stream.
process.on("unhandledRejection", (reason) => {
  console.error("[launcher] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[launcher] uncaught exception:", err);
});

const app = next({ dev, hostname: host, port });
const handle = app.getRequestHandler();

async function main(): Promise<void> {
  const token = getAuthToken();
  const bindingError = unsafeBindingError(host, token, process.env.LAUNCHER_ALLOW_INSECURE === "1");
  if (bindingError) {
    console.error(`[launcher] ${bindingError}`);
    process.exit(1);
  }

  try {
    acquireInstanceLock();
  } catch (err) {
    if (err instanceof InstanceLockError) {
      console.error(`[launcher] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  await app.prepare();
  await getDb();
  // Reconcile runs from before this start (adopt live ones, end the rest with a reason), then
  // keep supervising so the DB never drifts from reality.
  await startSupervisor();
  // Commands with auto-restart that were running before a reboot / crash come back now.
  const auto = await autoRestartAfterStartup();
  if (auto.restarted.length) console.log(`[launcher] auto-restarted: ${auto.restarted.join(", ")}`);
  if (auto.skipped.length) console.warn(`[launcher] not auto-restarted (crash-looping or failed): ${auto.skipped.join(", ")}`);

  const server = http.createServer((req, res) => {
    if (rejectUnauthorized(req, res, token)) return;
    void handle(req, res);
  });

  const io = new SocketIOServer(server, {
    path: SOCKET_IO_PATH,
    transports: ["polling", "websocket"],
    addTrailingSlash: false,
  });
  applySocketAuth(io, token);
  init(io);

  io.on("connection", (socket) => {
    handleSocketConnection(socket);
    if (dev) console.log("[socket.io] client connected");
  });

  const stopRetention = startLogRetention();

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[launcher] ${signal} received, shutting down (managed processes keep running)`);
    stopRetention();
    stopSupervisor();
    const force = setTimeout(() => process.exit(0), 5_000);
    force.unref();
    try {
      io.close();
      server.close();
      await stopAllTailing();
      await flushAllLogs();
      await closeDb();
      releaseInstanceLock();
    } catch (err) {
      console.error("[launcher] shutdown error:", err);
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  server.on("error", (err) => {
    console.error("[launcher] server error:", err);
    process.exit(1);
  });

  server.listen(port, host, () => {
    const shown = host === "0.0.0.0" || host === "::" ? "localhost" : host;
    console.log(
      `> Ready on http://${shown}:${port} (bound to ${host}; Socket.IO on ${SOCKET_IO_PATH})`
    );
    if (token) {
      console.log("> Auth enabled (LAUNCHER_TOKEN): sign in at /login");
    } else if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      console.warn(
        "> WARNING: listening on a non-loopback address WITHOUT auth (LAUNCHER_ALLOW_INSECURE=1). Anyone who can reach this port can run shell commands."
      );
    }
  });
}

main().catch((err) => {
  console.error("[launcher] failed to start:", err);
  process.exit(1);
});
