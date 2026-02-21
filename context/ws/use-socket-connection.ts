"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import type { IncomingMessage, LogChunk } from "./types";
import {
  CONNECTION_ERROR_AFTER_MS,
  RECONNECT_DELAY_MS,
} from "./constants";

function getSocketIoUrl(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export type SocketConnectionParams = {
  socketRef: React.MutableRefObject<Socket | null>;
  connectionErrorTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  setReady: (ready: boolean) => void;
  setConnectionError: (error: boolean) => void;
  onMessage: (message: IncomingMessage) => void;
};

function clearConnectionErrorTimeout(
  timeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
  if (timeoutRef.current != null) {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }
}

export function useSocketConnection(params: SocketConnectionParams): void {
  const {
    socketRef,
    connectionErrorTimeoutRef,
    setReady,
    setConnectionError,
    onMessage,
  } = params;

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const origin = getSocketIoUrl();
    if (!origin) return;

    const connect = (): void => {
      setConnectionError(false);
      clearConnectionErrorTimeout(connectionErrorTimeoutRef);

      if (process.env.NODE_ENV === "development") {
        console.log("[socket.io] connecting to", origin);
      }

      const socket = io(origin, {
        path: "/ws",
        transports: ["polling", "websocket"],
        autoConnect: true,
      });

      socketRef.current = socket;

      connectionErrorTimeoutRef.current = setTimeout(() => {
        connectionErrorTimeoutRef.current = null;
        if (socketRef.current && !socketRef.current.connected) {
          setConnectionError(true);
        }
      }, CONNECTION_ERROR_AFTER_MS);

      socket.on("connect", () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[socket.io] connected");
        }
        clearConnectionErrorTimeout(connectionErrorTimeoutRef);
        setReady(true);
        socket.emit("initial");
      });

      socket.on("connect_error", () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[socket.io] connect_error");
        }
        setConnectionError(true);
      });

      socket.on("disconnect", (reason) => {
        if (process.env.NODE_ENV === "development") {
          console.log("[socket.io] disconnect", reason);
        }
        setReady(false);
        socketRef.current = null;
        setTimeout(connect, RECONNECT_DELAY_MS);
      });

      const forward = (msg: IncomingMessage) => {
        onMessageRef.current(msg);
      };

      socket.on("commands", (data: unknown) => forward({ type: "commands", data }));
      socket.on("groups", (data: unknown) => forward({ type: "groups", data }));
      socket.on("log_history", (payload: { runId?: number; chunks?: LogChunk[] }) =>
        forward({ type: "log_history", runId: payload?.runId, chunks: payload?.chunks })
      );
      socket.on("log", (payload: { runId?: number; streamType?: string; data?: string }) =>
        forward({
          type: "log",
          runId: payload?.runId,
          streamType: payload?.streamType as "stdout" | "stderr" | undefined,
          data: payload?.data,
        })
      );
      socket.on("log_finished", (payload: { runId?: number }) =>
        forward({ type: "log_finished", runId: payload?.runId })
      );
      socket.on("action_result", (payload: unknown) => {
        const p = payload as Record<string, unknown>;
        forward({
          type: "action_result",
          requestId: p?.requestId as string | undefined,
          success: p?.success as boolean | undefined,
          data: p?.data,
          error: p?.error as string | undefined,
        });
      });
    };

    connect();

    return () => {
      clearConnectionErrorTimeout(connectionErrorTimeoutRef);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [socketRef, connectionErrorTimeoutRef, setReady, setConnectionError]);
}
