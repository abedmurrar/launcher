"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "@/context/ws";

type LogViewerProps = {
  runId: number;
  onClose: () => void;
};

export function LogViewer({ runId, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<{ streamType: "stdout" | "stderr"; data: string }[]>([]);
  const [live, setLive] = useState(true);
  const [clearing, setClearing] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const { subscribeToLogs, unsubscribeFromLogs } = useWs();

  const clearLogs = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/runs/${runId}/logs`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error ?? "Failed to clear logs");
        return;
      }
      setLogs([]);
    } finally {
      setClearing(false);
    }
  }, [runId, clearing]);

  useEffect(() => {
    subscribeToLogs(runId, {
      onHistory: (chunks) => {
        setLogs(
          chunks.map((c) => ({
            streamType: c.stream_type as "stdout" | "stderr",
            data: c.content,
          }))
        );
      },
      onChunk: (streamType, data) => {
        setLogs((prev) => [...prev, { streamType, data }]);
      },
      onFinished: () => setLive(false),
    });
    return () => unsubscribeFromLogs(runId);
  }, [runId, subscribeToLogs, unsubscribeFromLogs]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col w-full max-w-4xl max-h-[80vh] border border-zinc-300 dark:border-zinc-700">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-300 dark:border-zinc-700">
          <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
            Run #{runId} {live && "(live)"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearLogs}
              disabled={clearing || logs.length === 0}
              className="px-3 py-1 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-300 dark:hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {clearing ? "Clearing…" : "Clear logs"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500 text-sm"
            >
              Close
            </button>
          </div>
        </div>
        <pre
          ref={preRef}
          className="flex-1 overflow-auto p-4 text-sm font-mono whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200"
        >
          {logs.map((entry, i) => (
            <span
              key={i}
              className={entry.streamType === "stderr" ? "text-red-600 dark:text-red-400" : ""}
            >
              {entry.data}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
