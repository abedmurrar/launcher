import http from "http";
import type { AddressInfo } from "net";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { insertCommand, getRunDetailsById, getLogChunksFullByRunId } from "@/lib/db/queries";
import { runIdToPid } from "@/lib/process-manager/state";
import { killProcessGroup } from "@/lib/process-manager/kill";
import { isProcessGroupAlive, waitFor as pollUntil } from "@/lib/process-manager/process-utils";
import { init } from "@/lib/ws-broadcast";
import { handleSocketConnection } from "@/server/ws-handler";
import { applySocketAuth } from "@/server/auth";

/** Poll until `check` is true (default timeout 10s). */
export function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<boolean> {
  return pollUntil(check, timeoutMs);
}

let counter = 0;

/** Create a command row and return its id. */
export async function createCommand(command: string, name = `cmd-${++counter}`): Promise<number> {
  return insertCommand(name, command, "/tmp", "{}");
}

export async function waitForRunStatus(runId: number, status: string, timeoutMs = 10_000): Promise<boolean> {
  return waitFor(async () => (await getRunDetailsById(runId))?.status === status, timeoutMs);
}

export async function runLogText(runId: number): Promise<string> {
  const chunks = await getLogChunksFullByRunId(runId);
  return chunks.map((c) => c.content).join("");
}

/** SIGKILL every process group still tracked (test cleanup). */
export async function killAllTracked(): Promise<void> {
  const pids = [...runIdToPid.values()];
  for (const pid of pids) killProcessGroup(pid, "SIGKILL");
  await waitFor(() => pids.every((p) => !isProcessGroupAlive(p)), 2_000);
}

export interface TestSocketServer {
  url: string;
  io: SocketIOServer;
  connect: (opts?: { cookie?: string }) => Promise<ClientSocket>;
  close: () => Promise<void>;
}

/** Socket.IO server wired exactly like server/index.ts, but without Next. */
export async function startSocketServer(opts: { token?: string } = {}): Promise<TestSocketServer> {
  const server = http.createServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });
  const io = new SocketIOServer(server, { path: "/ws", addTrailingSlash: false });
  applySocketAuth(io, opts.token ?? null);
  init(io);
  io.on("connection", handleSocketConnection);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const clients: ClientSocket[] = [];

  return {
    url,
    io,
    connect: async (connectOpts = {}) => {
      const socket = ioClient(url, {
        path: "/ws",
        transports: ["websocket"],
        reconnectionDelay: 100,
        reconnection: false,
        extraHeaders: connectOpts.cookie ? { Cookie: connectOpts.cookie } : undefined,
      });
      clients.push(socket);
      await new Promise<void>((resolve, reject) => {
        socket.once("connect", () => resolve());
        socket.once("connect_error", reject);
      });
      return socket;
    },
    close: async () => {
      clients.forEach((c) => c.close());
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}

/** Assert an ActionResult succeeded and return its data. */
export function ok<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
  if (!result.success) throw new Error(`expected success, got: ${result.error}`);
  return result.data as T;
}

/**
 * Simulate the launcher process dying without touching the managed processes:
 * drop all in-memory tracking (as a fresh process would have) but leave children running.
 */
export async function simulateLauncherCrash(): Promise<void> {
  const { stopAllTailing } = await import("@/lib/process-manager/log-tailer");
  const { pidMap, groupRunIdToPids } = await import("@/lib/process-manager/state");
  await stopAllTailing();
  for (const record of pidMap.values()) {
    record.childProcess?.removeAllListeners();
    record.childProcess?.unref();
  }
  pidMap.clear();
  runIdToPid.clear();
  groupRunIdToPids.clear();
  const g = globalThis as Record<string, unknown>;
  const watchers = g["__launcher_adopted-watchers"] as Map<number, ReturnType<typeof setInterval>> | undefined;
  watchers?.forEach((t) => clearInterval(t));
  watchers?.clear();
  (g["__launcher_finalized-runs"] as Set<number> | undefined)?.clear();
}
