import http from "http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { getDb, closeDb } from "../lib/db/connection";
import { reconcileStaleRuns, flushAllLogs, stopAllTailing } from "../lib/process-manager";
import { init } from "../lib/ws-broadcast";
import { startLogRetention } from "../lib/log-retention";
import { handleSocketConnection } from "./ws-handler";
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
  await app.prepare();
  await getDb();
  await reconcileStaleRuns();

  const server = http.createServer((req, res) => {
    void handle(req, res);
  });

  const io = new SocketIOServer(server, {
    path: SOCKET_IO_PATH,
    transports: ["polling", "websocket"],
    addTrailingSlash: false,
  });
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
    const force = setTimeout(() => process.exit(0), 5_000);
    force.unref();
    try {
      io.close();
      server.close();
      await stopAllTailing();
      await flushAllLogs();
      await closeDb();
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
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
      console.warn(
        "> WARNING: listening on a non-loopback address. Anyone who can reach this port can run shell commands."
      );
    }
  });
}

main().catch((err) => {
  console.error("[launcher] failed to start:", err);
  process.exit(1);
});
