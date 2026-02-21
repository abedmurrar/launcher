import http from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { init, registerClient, unregisterClient } from "../lib/ws-broadcast";
import { handleSocketConnection } from "./ws-handler";
import { dev, port, SOCKET_IO_PATH } from "./config";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  init();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    path: SOCKET_IO_PATH,
    transports: ["polling", "websocket"],
    addTrailingSlash: false,
  });

  io.on("connection", (socket) => {
    registerClient(socket);
    handleSocketConnection(socket);

    socket.on("disconnect", () => {
      unregisterClient(socket);
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[socket.io] client connected");
    }
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(
      `> Ready on http://localhost:${port} (Socket.IO on ${SOCKET_IO_PATH}, transports: polling, websocket)`
    );
  });
});
