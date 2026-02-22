"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api";
import { useWs } from "@/context/ws";

const MIN_PANEL_PCT = 8;
const RESIZE_HANDLE_WIDTH = 6;

interface LogStreamPanelProps {
  runId: number;
  title: string;
}

function LogStreamPanel({ runId, title }: LogStreamPanelProps) {
  const [logs, setLogs] = useState<{ streamType: "stdout" | "stderr"; data: string }[]>([]);
  const preRef = useRef<HTMLPreElement>(null);
  const { subscribeToLogs, unsubscribeFromLogs } = useWs();

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
      onFinished: () => {},
    });
    return () => unsubscribeFromLogs(runId);
  }, [runId, subscribeToLogs, unsubscribeFromLogs]);

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="flex flex-col rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/80 overflow-hidden min-h-0 h-full">
      <div className="px-3 py-1.5 border-b border-zinc-300 dark:border-zinc-600 font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate shrink-0">
        {title}
      </div>
      <pre
        ref={preRef}
        className="flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200 min-h-[120px]"
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
  );
}

interface GroupLogViewerProps {
  groupRunId: number;
  onClose: () => void;
}

interface GroupRunRunsResponse {
  groupRunId: number;
  runs: { runId: number; commandName: string }[];
}

/** Returns flex-grow weights (positive numbers) and a resize function. */
function useEqualWidths(count: number): [number[], (index: number, deltaPct: number) => void] {
  const [widths, setWidths] = useState<number[]>(() =>
    count > 0 ? Array.from({ length: count }, () => 1) : []
  );

  useEffect(() => {
    if (count > 0 && widths.length !== count) {
      setWidths(Array.from({ length: count }, () => 1));
    }
  }, [count]);

  const resize = useCallback((index: number, deltaPct: number) => {
    setWidths((prev) => {
      if (index < 0 || index >= prev.length - 1) return prev;
      const total = prev.reduce((a, b) => a + b, 0);
      const deltaRatio = (deltaPct / 100) * total;
      const next = [...prev];
      let left = next[index] + deltaRatio;
      let right = next[index + 1] - deltaRatio;
      const minRatio = (MIN_PANEL_PCT / 100) * total;
      if (left < minRatio || right < minRatio) return prev;
      next[index] = left;
      next[index + 1] = right;
      return next;
    });
  }, []);

  return [widths, resize];
}

function ResizeHandle({
  onDrag,
}: {
  onDrag: (deltaPct: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onDragRef = useRef(onDrag);
  onDragRef.current = onDrag;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const el = containerRef.current?.closest(".flex.flex-row.overflow-hidden");
    const containerWidth = el?.getBoundingClientRect().width ?? 1;
    let startX = e.clientX;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaPx = moveEvent.clientX - startX;
      startX = moveEvent.clientX;
      const deltaPct = (deltaPx / containerWidth) * 100;
      onDragRef.current(deltaPct);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div
      ref={containerRef}
      role="separator"
      aria-orientation="vertical"
      onMouseDown={handleMouseDown}
      className="shrink-0 w-1.5 flex items-stretch cursor-col-resize group bg-zinc-700 hover:bg-zinc-500 transition-colors"
      style={{ minWidth: RESIZE_HANDLE_WIDTH }}
    >
      <div className="w-0.5 bg-zinc-600 group-hover:bg-zinc-400 mx-auto" />
    </div>
  );
}

export function GroupLogViewer({ groupRunId, onClose }: GroupLogViewerProps) {
  const [runs, setRuns] = useState<{ runId: number; commandName: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [widths, resize] = useEqualWidths(runs?.length ?? 0);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<GroupRunRunsResponse>(`/api/group-runs/${groupRunId}/runs`)
      .then((res) => {
        if (cancelled) return;
        if (res.status >= 200 && res.status < 300 && res.data?.runs) {
          setRuns(res.data.runs);
          setError(null);
        } else {
          setError((res.data as { error?: string })?.error ?? "Failed to load runs");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load runs");
      });
    return () => {
      cancelled = true;
    };
  }, [groupRunId]);

  const handleResize = useCallback(
    (index: number) => (deltaPct: number) => resize(index, deltaPct),
    [resize]
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-sm text-zinc-200">
          Group run #{groupRunId}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-zinc-500 text-white hover:bg-zinc-600 text-sm"
        >
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-zinc-600 bg-zinc-900 overflow-hidden">
        {error && (
          <div className="p-4 text-red-400 text-sm">{error}</div>
        )}
        {runs != null && runs.length === 0 && (
          <div className="p-4 text-zinc-400 text-sm">No runs in this group run.</div>
        )}
        {runs != null && runs.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-row overflow-hidden p-2 gap-0 flex-nowrap">
            {runs.map(({ runId, commandName }, i) => (
              <Fragment key={runId}>
                <div
                  className="min-h-0 min-w-0 overflow-hidden flex-[1_1_0]"
                  style={{
                    flexGrow: widths[i],
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: `min(${MIN_PANEL_PCT}%, 120px)`,
                  }}
                >
                  <LogStreamPanel runId={runId} title={commandName} />
                </div>
                {i < runs.length - 1 && (
                  <ResizeHandle onDrag={handleResize(i)} />
                )}
              </Fragment>
            ))}
          </div>
        )}
        {runs == null && !error && (
          <div className="p-4 text-zinc-400 text-sm">Loading…</div>
        )}
      </div>
    </div>
  );
}
