"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { IncomingMessage, LiveLogChunk, LogChunk } from "./types";
import { CONNECTION_ERROR_AFTER_MS, RECONNECT_DELAY_MS } from "./constants";

export interface SocketConnectionParams {
  socketRef: React.MutableRefObject<Socket | null>;
  setReady: (ready: boolean) => void;
  setConnectionError: (error: boolean) => void;
  onMessage: (message: IncomingMessage) => void;
  /** Called on every (re)connect, e.g. to re-subscribe to logs. */
  onConnect: (socket: Socket) => void;
}

/** Auth is enabled and the session is missing/expired: go sign in, then come back. */
export function redirectToLogin(): void {
  if (typeof window === "undefined" || window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login?next=${encodeURIComponent(next)}`;
}

const debug = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") console.log("[socket.io]", ...args);
};

/**
 * One Socket.IO connection for the app's lifetime. Reconnection is handled by Socket.IO itself
 * (with backoff); we only re-request state and re-subscribe after each connect.
 */
export function useSocketConnection(params: SocketConnectionParams): void {
  const { socketRef, setReady, setConnectionError } = params;

  const onMessageRef = useRef(params.onMessage);
  const onConnectRef = useRef(params.onConnect);
  useLayoutEffect(() => {
    onMessageRef.current = params.onMessage;
    onConnectRef.current = params.onConnect;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const socket = io(window.location.origin, {
      path: "/ws",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    let errorTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      errorTimer = null;
      if (!socket.connected) setConnectionError(true);
    }, CONNECTION_ERROR_AFTER_MS);
    const clearErrorTimer = () => {
      if (errorTimer !== null) clearTimeout(errorTimer);
      errorTimer = null;
    };

    socket.on("connect", () => {
      debug("connected");
      clearErrorTimer();
      setConnectionError(false);
      setReady(true);
      socket.emit("initial");
      onConnectRef.current(socket);
    });

    socket.on("connect_error", (err) => {
      debug("connect_error", err?.message);
      if (err?.message === "unauthorized") {
        redirectToLogin();
        return;
      }
      setConnectionError(true);
    });

    socket.on("disconnect", (reason) => {
      debug("disconnect", reason);
      setReady(false);
      // Socket.IO doesn't auto-reconnect after a server-initiated disconnect.
      if (reason === "io server disconnect") socket.connect();
    });

    const forward = (msg: IncomingMessage) => onMessageRef.current(msg);

    socket.on("commands", (data: unknown) => forward({ type: "commands", data }));
    socket.on("groups", (data: unknown) => forward({ type: "groups", data }));
    socket.on(
      "log_history",
      (p: {
        runId?: number;
        chunks?: LogChunk[];
        truncated?: boolean;
        lastId?: number;
        firstId?: number;
        live?: boolean;
      }) =>
        forward({ type: "log_history", ...p })
    );
    socket.on("log_batch", (p: { runId?: number; chunks?: LiveLogChunk[]; lastId?: number }) =>
      forward({ type: "log_batch", ...p })
    );
    socket.on("log_finished", (p: { runId?: number }) => forward({ type: "log_finished", ...p }));

    return () => {
      clearErrorTimer();
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [socketRef, setReady, setConnectionError]);
}
