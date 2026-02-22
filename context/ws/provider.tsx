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
  createSocketIoActionSender,
} from "./adapters";
import { fetchAction } from "./http-fallback";
import { handleIncomingMessage } from "./message-handler";
import { useSocketConnection } from "./use-socket-connection";
import { useInitialLoadFallback } from "./use-initial-load-fallback";
import { usePollingWhenDisconnected } from "./use-polling-when-disconnected";
import { ACTION_TIMEOUT_MS } from "./constants";
import type { Socket } from "socket.io-client";

const WsContext = createContext<WsContextValue | null>(null);

export function WsProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<CommandListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  const socketRef = useRef<Socket | null>(null);
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
  const connectionErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const socketActionSenderRef = useRef<
    ((actionType: string, payload: Record<string, unknown>) => Promise<ActionResult>) | null
  >(null);

  useLayoutEffect(() => {
    socketActionSenderRef.current = createSocketIoActionSender({
      getSocket: () => socketRef.current,
      getPendingActions: () => pendingActionsRef.current,
      timeoutMs: ACTION_TIMEOUT_MS,
      fallbackSender: httpActionSender,
    });
  }, [httpActionSender]);

  const sendAction = useCallback(
    (actionType: string, payload: Record<string, unknown>): Promise<ActionResult> => {
      const socket = socketRef.current;
      if (socket == null || !socket.connected) {
        return httpActionSender(actionType, payload);
      }
      return socketActionSenderRef.current!(actionType, payload);
    },
    [httpActionSender]
  );

  const subscribeToLogs = useCallback((runId: number, callbacks: LogCallbacks) => {
    logSubscribersRef.current.set(runId, callbacks);
    socketRef.current?.emit("subscribe_logs", runId);
  }, []);

  const unsubscribeFromLogs = useCallback((runId: number) => {
    logSubscribersRef.current.delete(runId);
    socketRef.current?.emit("unsubscribe_logs", runId);
  }, []);

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

  useSocketConnection({
    socketRef,
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
