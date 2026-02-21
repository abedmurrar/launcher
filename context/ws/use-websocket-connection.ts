"use client";

import { useEffect, useRef } from "react";
import type { IncomingMessage } from "./types";
import { getWsUrl } from "./helpers";
import { parseMessage } from "./helpers";
import {
  CONNECTION_ERROR_AFTER_MS,
  RECONNECT_DELAY_MS,
} from "./constants";

export type WebSocketConnectionParams = {
  webSocketRef: React.MutableRefObject<WebSocket | null>;
  reconnectTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
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

export function useWebSocketConnection(
  params: WebSocketConnectionParams
): void {
  const {
    webSocketRef,
    reconnectTimeoutRef,
    connectionErrorTimeoutRef,
    setReady,
    setConnectionError,
    onMessage,
  } = params;

  useEffect(() => {
    const webSocketUrl = getWsUrl();
    if (!webSocketUrl) return;

    const connect = (): void => {
      setConnectionError(false);
      clearConnectionErrorTimeout(connectionErrorTimeoutRef);

      if (
        typeof window !== "undefined" &&
        process.env.NODE_ENV === "development"
      ) {
        console.log("[ws] connecting to", webSocketUrl);
      }

      let webSocket: WebSocket;
      try {
        webSocket = new WebSocket(webSocketUrl);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.log("[ws] new WebSocket threw", error);
        }
        setConnectionError(true);
        return;
      }

      webSocketRef.current = webSocket;

      connectionErrorTimeoutRef.current = setTimeout(() => {
        connectionErrorTimeoutRef.current = null;
        if (
          webSocketRef.current == null ||
          webSocketRef.current.readyState !== WebSocket.OPEN
        ) {
          setConnectionError(true);
        }
      }, CONNECTION_ERROR_AFTER_MS);

      webSocket.onopen = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[ws] open");
        }
        clearConnectionErrorTimeout(connectionErrorTimeoutRef);
        setReady(true);
        setTimeout(() => {
          if (
            webSocketRef.current === webSocket &&
            webSocket.readyState === WebSocket.OPEN
          ) {
            webSocket.send(JSON.stringify({ type: "initial" }));
          }
        }, 0);
      };

      webSocket.onerror = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[ws] error");
        }
        setConnectionError(true);
      };

      webSocket.onclose = () => {
        if (process.env.NODE_ENV === "development") {
          console.log("[ws] close");
        }
        setReady(false);
        webSocketRef.current = null;
        reconnectTimeoutRef.current = setTimeout(
          connect,
          RECONNECT_DELAY_MS
        );
      };

      webSocket.onmessage = (event: MessageEvent) => {
        const parsedMessage = parseMessage(event);
        if (parsedMessage != null) {
          onMessage(parsedMessage);
        }
      };
    };

    const connectTimeoutId = setTimeout(connect, 0);

    return () => {
      clearTimeout(connectTimeoutId);
      clearConnectionErrorTimeout(connectionErrorTimeoutRef);
      if (reconnectTimeoutRef.current != null) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      webSocketRef.current?.close();
      webSocketRef.current = null;
    };
  }, [onMessage]);
}
