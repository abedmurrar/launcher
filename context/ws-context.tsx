"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CommandListItem = {
  id: number;
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  last_exit_code: number | null;
  running: boolean;
  run_id?: number;
  last_run_id?: number;
  pid?: number;
};

export type GroupListItem = {
  id: number;
  name: string;
  created_at: string;
  command_ids: number[];
  last_run?:
    | { id: number; started_at: string; finished_at: string | null; status: string }
    | undefined;
  running: boolean;
  running_group_run_id?: number;
};

type LogChunk = { stream_type: string; content: string };

type LogCallbacks = {
  onHistory?: (chunks: LogChunk[]) => void;
  onChunk: (streamType: "stdout" | "stderr", data: string) => void;
  onFinished: () => void;
};

export type ActionResult = { success: boolean; data?: unknown; error?: string };

type WsContextValue = {
  commands: CommandListItem[];
  groups: GroupListItem[];
  ready: boolean;
  initialLoadDone: boolean;
  sendAction: (type: string, payload: Record<string, unknown>) => Promise<ActionResult>;
  subscribeToLogs: (runId: number, callbacks: LogCallbacks) => void;
  unsubscribeFromLogs: (runId: number) => void;
};

const WsContext = createContext<WsContextValue | null>(null);

function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export function WsProvider({ children }: { children: ReactNode }) {
  const [commands, setCommands] = useState<CommandListItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const logSubscribersRef = useRef<Map<number, LogCallbacks>>(new Map());
  const pendingActionsRef = useRef<Map<string, (result: ActionResult) => void>>(new Map());
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const subscribeToLogs = useCallback(
    (runId: number, callbacks: LogCallbacks) => {
      logSubscribersRef.current.set(runId, callbacks);
      send({ type: "subscribe_logs", runId });
    },
    [send]
  );

  const unsubscribeFromLogs = useCallback(
    (runId: number) => {
      logSubscribersRef.current.delete(runId);
      send({ type: "unsubscribe_logs", runId });
    },
    [send]
  );

  const sendAction = useCallback(
    (type: string, payload: Record<string, unknown>): Promise<ActionResult> => {
      return new Promise((resolve) => {
        const requestId = crypto.randomUUID();
        pendingActionsRef.current.set(requestId, resolve);
        send({ type, requestId, ...payload });
        setTimeout(() => {
          if (pendingActionsRef.current.delete(requestId)) {
            resolve({ success: false, error: "Request timeout" });
          }
        }, 30000);
      });
    },
    [send]
  );

  useEffect(() => {
    const url = getWsUrl();
    if (!url) return;

    const connect = () => {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setReady(true);

      ws.onclose = () => {
        setReady(false);
        wsRef.current = null;
        reconnectRef.current = setTimeout(connect, 2000);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            data?: unknown;
            runId?: number;
            streamType?: "stdout" | "stderr";
            requestId?: string;
            success?: boolean;
            error?: string;
            chunks?: Array<{ stream_type: string; content: string }>;
          };
          if (msg.type === "commands" && Array.isArray(msg.data)) {
            setCommands(msg.data as CommandListItem[]);
            setInitialLoadDone(true);
          } else if (msg.type === "groups" && Array.isArray(msg.data)) {
            setGroups(msg.data as GroupListItem[]);
          } else if (msg.type === "log_history" && typeof msg.runId === "number" && Array.isArray(msg.chunks)) {
            const subs = logSubscribersRef.current.get(msg.runId);
            subs?.onHistory?.(msg.chunks);
          } else if (msg.type === "log" && typeof msg.runId === "number" && msg.streamType && msg.data !== undefined) {
            const subs = logSubscribersRef.current.get(msg.runId);
            subs?.onChunk(msg.streamType, String(msg.data));
          } else if (msg.type === "log_finished" && typeof msg.runId === "number") {
            const subs = logSubscribersRef.current.get(msg.runId);
            subs?.onFinished();
            logSubscribersRef.current.delete(msg.runId);
          } else if (typeof msg.type === "string" && msg.type.endsWith("_result") && typeof msg.requestId === "string") {
            const resolve = pendingActionsRef.current.get(msg.requestId);
            if (resolve) {
              pendingActionsRef.current.delete(msg.requestId);
              resolve({
                success: Boolean(msg.success),
                data: msg.data,
                error: typeof msg.error === "string" ? msg.error : undefined,
              });
            }
          }
        } catch {
          // ignore
        }
      };
    };

    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  const value: WsContextValue = {
    commands,
    groups,
    ready,
    initialLoadDone,
    sendAction,
    subscribeToLogs,
    unsubscribeFromLogs,
  };

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextValue {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error("useWs must be used within WsProvider");
  return ctx;
}
