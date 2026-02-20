import http from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import {
  init,
  registerClient,
  unregisterClient,
  subscribeLogs,
  unsubscribeLogs,
  sendToClient,
} from "./lib/ws-broadcast";
import {
  runCommand,
  stopCommand,
  restartCommand,
  createCommand,
  updateCommand,
  deleteCommand,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupCommands,
  runGroup,
} from "./lib/actions";

const dev = process.env.NODE_ENV !== "production";
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  init();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  async function handleAction(
    ws: WebSocket,
    type: string,
    requestId: string | undefined,
    payload: Record<string, unknown>
  ) {
    const sendResult = (result: { success: boolean; data?: unknown; error?: string; code?: number }) => {
      sendToClient(ws, { type: `${type}_result`, requestId, ...result });
    };
    try {
      if (type === "run") {
        const commandId = Number(payload.commandId);
        const result = runCommand(commandId);
        sendResult(result);
      } else if (type === "stop") {
        const commandId = Number(payload.commandId);
        const runId = payload.runId != null ? Number(payload.runId) : undefined;
        const result = stopCommand(commandId, runId);
        sendResult(result);
      } else if (type === "restart") {
        const commandId = Number(payload.commandId);
        const result = await restartCommand(commandId);
        sendResult(result);
      } else if (type === "create_command") {
        const result = createCommand(payload.data);
        sendResult(result);
      } else if (type === "update_command") {
        const id = Number(payload.id);
        const result = updateCommand(id, payload.data ?? {});
        sendResult(result);
      } else if (type === "delete_command") {
        const id = Number(payload.id);
        const result = deleteCommand(id);
        sendResult(result);
      } else if (type === "create_group") {
        const result = createGroup(payload.data ?? { name: payload.name });
        sendResult(result);
      } else if (type === "update_group") {
        const id = Number(payload.id);
        const result = updateGroup(id, payload.data ?? { name: payload.name });
        sendResult(result);
      } else if (type === "delete_group") {
        const id = Number(payload.id);
        const result = deleteGroup(id);
        sendResult(result);
      } else if (type === "set_group_commands") {
        const id = Number(payload.id);
        const result = setGroupCommands(id, payload.data ?? { commandIds: payload.commandIds ?? [] });
        sendResult(result);
      } else if (type === "run_group") {
        const groupId = Number(payload.groupId);
        const result = runGroup(groupId);
        sendResult(result);
      }
    } catch (err) {
      sendResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  wss.on("connection", (ws: WebSocket, _req: http.IncomingMessage) => {
    registerClient(ws);
    ws.on("message", (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          requestId?: string;
          runId?: number;
          commandId?: number;
          groupId?: number;
          id?: number;
          data?: unknown;
          name?: string;
          commandIds?: number[];
        };
        if (msg.type === "subscribe_logs" && typeof msg.runId === "number") {
          subscribeLogs(ws, msg.runId);
        } else if (msg.type === "unsubscribe_logs" && typeof msg.runId === "number") {
          unsubscribeLogs(ws, msg.runId);
        } else if (
          ["run", "stop", "restart", "create_command", "update_command", "delete_command",
           "create_group", "update_group", "delete_group", "set_group_commands", "run_group"].includes(msg.type)
        ) {
          handleAction(ws, msg.type, msg.requestId, msg as Record<string, unknown>);
        }
      } catch {
        // ignore invalid JSON
      }
    });
    ws.on("close", () => {
      unregisterClient(ws);
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "", true);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (WebSocket on /ws)`);
  });
});
