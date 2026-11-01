"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import type {
  CommandListItem,
  GroupListItem,
  LogCallbacks,
  ActionResult,
  IncomingMessage,
  RestoreOffer,
  WsContextValue,
} from "./types";
import { createHttpActionSender, createSocketIoActionSender } from "./adapters";
import { fetchAction } from "./http-fallback";
import { handleIncomingMessage } from "./message-handler";
import { useSocketConnection } from "./use-socket-connection";
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
  const [restoreOffers, setRestoreOffers] = useState<RestoreOffer[]>([]);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState(0);
  const markSynced = useCallback(() => setLastSyncAt(Date.now()), []);

  const socketRef = useRef<Socket | null>(null);
  const logSubscribersRef = useRef<Map<number, LogCallbacks>>(new Map());

  const onListsUpdated = useCallback(
    (commandsList: CommandListItem[], groupsList: GroupListItem[]) => {
      setCommands(commandsList);
      setGroups(groupsList);
      setLastSyncAt(Date.now());
    },
    []
  );

  const httpActionSender = useMemo(
    () => createHttpActionSender(fetchAction, onListsUpdated),
    [onListsUpdated]
  );

  // Built per call (event time) so the socket ref is only read outside render.
  const sendAction = useCallback(
    (actionType: string, payload: Record<string, unknown>): Promise<ActionResult> =>
      createSocketIoActionSender({
        socketRef,
        timeoutMs: ACTION_TIMEOUT_MS,
        fallbackSender: httpActionSender,
      })(actionType, payload),
    [httpActionSender]
  );

  const subscribeToLogs = useCallback((runId: number, callbacks: LogCallbacks) => {
    logSubscribersRef.current.set(runId, callbacks);
    if (socketRef.current?.connected) socketRef.current.emit("subscribe_logs", runId);
  }, []);

  const unsubscribeFromLogs = useCallback((runId: number) => {
    logSubscribersRef.current.delete(runId);
    if (socketRef.current?.connected) socketRef.current.emit("unsubscribe_logs", runId);
  }, []);

  /** After every (re)connect, re-subscribe so live logs resume and missed output is re-sent. */
  const onConnect = useCallback((socket: Socket) => {
    logSubscribersRef.current.forEach((_callbacks, runId) => socket.emit("subscribe_logs", runId));
  }, []);

  const handleIncomingMessageCallback = useCallback((message: IncomingMessage) => {
    handleIncomingMessage(message, {
      setCommands,
      setGroups,
      setInitialLoadDone,
      setConnectionError,
      getLogSubscribers: () => logSubscribersRef.current,
      setRestoreOffers,
      setInstanceId,
      markSynced,
    });
  }, [markSynced]);

  useSocketConnection({
    socketRef,
    setReady,
    setConnectionError,
    onMessage: handleIncomingMessageCallback,
    onConnect,
  });

  const setCommandsSynced = useCallback(
    (list: CommandListItem[]) => {
      setCommands(list);
      markSynced();
    },
    [markSynced]
  );

  useInitialLoadFallback({
    initialLoadDone,
    connectionError,
    setCommands: setCommandsSynced,
    setGroups,
    setInitialLoadDone,
  });

  usePollingWhenDisconnected({
    ready,
    setCommands: setCommandsSynced,
    setGroups,
    setInitialLoadDone,
  });

  const contextValue = useMemo<WsContextValue>(
    () => ({
      commands,
      groups,
      ready,
      initialLoadDone,
      connectionError,
      restoreOffers,
      instanceId,
      lastSyncAt,
      sendAction,
      subscribeToLogs,
      unsubscribeFromLogs,
    }),
    [
      commands,
      groups,
      ready,
      initialLoadDone,
      connectionError,
      restoreOffers,
      instanceId,
      lastSyncAt,
      sendAction,
      subscribeToLogs,
      unsubscribeFromLogs,
    ]
  );

  return <WsContext.Provider value={contextValue}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextValue {
  const context = useContext(WsContext);
  if (context == null) {
    throw new Error("useWs must be used within WsProvider");
  }
  return context;
}
