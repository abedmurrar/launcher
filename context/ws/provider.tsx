"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CommandListItem,
  GroupListItem,
  LogCallbacks,
  ActionResult,
  IncomingMessage,
  WsContextValue,
} from "./types";
import {
  createHttpActionSender,
  createWebSocketActionSender,
} from "./adapters";
import { fetchAction } from "./http-fallback";
import { handleIncomingMessage } from "./message-handler";
import { useWebSocketConnection } from "./use-websocket-connection";
import { useInitialLoadFallback } from "./use-initial-load-fallback";
import { usePollingWhenDisconnected } from "./use-polling-when-disconnected";
import { ACTION_TIMEOUT_MS } from "./constants";

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<CommandListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const webSocketRef = useRef<WebSocket | null>(null);
  const logSubscribersRef = useRef<Map<number, LogCallbacks>>(new Map());
  const pendingActionsRef = useRef<
    Map<
      string,
      {
        resolve: (result: ActionResult) => void;
        type: string;
        payload: Record<string, unknown>;
      }
    >
  >(new Map());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const sendOverWebSocket = useCallback((message: unknown) => {
    const webSocket = webSocketRef.current;
    if (webSocket?.readyState === WebSocket.OPEN) {
      webSocket.send(JSON.stringify(message));
    }
  }, []);

  const onListsUpdated = useCallback(
    (commandsList: CommandListItem[], groupsList: GroupListItem[]) => {
      setCommands(commandsList);
      setGroups(groupsList);
    },
    []
  );

  const httpActionSender = useMemo(
    () => createHttpActionSender(fetchAction, onListsUpdated),
    [onListsUpdated]
  );

  const webSocketActionSenderRef = useRef<((actionType: string, payload: Record<string, unknown>) => Promise<ActionResult>) | null>(null);

  useLayoutEffect(() => {
    webSocketActionSenderRef.current = createWebSocketActionSender({
      sendOverWebSocket,
      getPendingActions: () => pendingActionsRef.current,
      timeoutMs: ACTION_TIMEOUT_MS,
      fallbackSender: httpActionSender,
    });
  }, [sendOverWebSocket, httpActionSender]);

  const sendAction = useCallback(
    (actionType: string, payload: Record<string, unknown>): Promise<ActionResult> => {
      const webSocket = webSocketRef.current;
      if (
        webSocket == null ||
        webSocket.readyState !== WebSocket.OPEN
      ) {
        return httpActionSender(actionType, payload);
      }
      return webSocketActionSenderRef.current!(actionType, payload);
    },
    [httpActionSender]
  );

  const subscribeToLogs = useCallback(
    (runId: number, callbacks: LogCallbacks) => {
      logSubscribersRef.current.set(runId, callbacks);
      sendOverWebSocket({ type: "subscribe_logs", runId });
    },
    [sendOverWebSocket]
  );

  const unsubscribeFromLogs = useCallback(
    (runId: number) => {
      logSubscribersRef.current.delete(runId);
      sendOverWebSocket({ type: "unsubscribe_logs", runId });
    },
    [sendOverWebSocket]
  );

  const doHttpAction = useCallback(
    (actionType: string, payload: Record<string, unknown>) =>
      httpActionSender(actionType, payload),
    [httpActionSender]
  );

  const handleIncomingMessageCallback = useCallback(
    (message: IncomingMessage) => {
      handleIncomingMessage(message, {
        setCommands,
        setGroups,
        setInitialLoadDone,
        setConnectionError,
        getLogSubscribers: () => logSubscribersRef.current,
        getPendingActions: () => pendingActionsRef.current,
        doHttpAction,
      });
    },
    [doHttpAction]
  );

  useWebSocketConnection({
    webSocketRef,
    reconnectTimeoutRef,
    connectionErrorTimeoutRef,
    setReady,
    setConnectionError,
    onMessage: handleIncomingMessageCallback,
  });

  useInitialLoadFallback({
    initialLoadDone,
    connectionError,
    setCommands,
    setGroups,
    setInitialLoadDone,
  });

  usePollingWhenDisconnected({
    ready,
    setCommands,
    setGroups,
    setInitialLoadDone,
  });

  const contextValue: WsContextValue = {
    commands,
    groups,
    ready,
    initialLoadDone,
    connectionError,
    sendAction,
    subscribeToLogs,
    unsubscribeFromLogs,
  };

  return (
    <WsContext.Provider value={contextValue}>
      {children}
    </WsContext.Provider>
  );
}

export function useWs(): WsContextValue {
  const context = useContext(WsContext);
  if (context == null) {
    throw new Error("useWs must be used within WsProvider");
  }
  return context;
}
