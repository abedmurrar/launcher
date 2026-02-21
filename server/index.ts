import http from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import {
  init,
  registerClient,
  unregisterClient,
} from "../lib/ws-broadcast";
import { handleWebSocketMessage } from "./ws-handler";
import { dev, port, WS_PATH } from "./config";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  init();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (ws: WebSocket) => {
    registerClient(ws);

    ws.on("message", (raw: Buffer | string) => {
      handleWebSocketMessage(ws, raw);
    });

    ws.on("close", () => {
      unregisterClient(ws);
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "", true);
    const path = pathname?.replace(/\/$/, "") || "";
    if (path === WS_PATH) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
        console.log("[ws] client connected");
      });
    } else {
      if (!path.startsWith("/_next/")) {
        console.log("[ws] upgrade rejected, path:", pathname);
      }
      socket.destroy();
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://localhost:${port} (WebSocket on ${WS_PATH})`);
  });
});
