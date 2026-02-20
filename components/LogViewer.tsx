"use client";

import { useEffect, useRef, useState } from "react";

type LogViewerProps = {
  runId: number;
  onClose: () => void;
};

export function LogViewer({ runId, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<{ streamType: "stdout" | "stderr"; data: string }[]>([]);
  const [live, setLive] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    (async () => {
      try {
        const url = `/api/runs/${runId}/logs/stream`;
        const res = await fetch(url, { signal: ac.signal });
        if (!res.body || cancelled) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (cancelled) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const payload = JSON.parse(line.slice(6));
                if (payload.event === "finished") {
                  if (!cancelled) setLive(false);
                  break;
                }
                if (payload.streamType && payload.data !== undefined && !cancelled) {
                  setLogs((prev) => [...prev, { streamType: payload.streamType, data: payload.data }]);
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        throw err;
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [runId]);

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
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500 text-sm"
          >
            Close
          </button>
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
