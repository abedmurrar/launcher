"use client";

import { useCallback, useState } from "react";
import axios from "axios";
import { apiClient } from "@/lib/api";
import { useRunLogs } from "@/hooks/useRunLogs";
import { LogPane } from "@/components/shared/LogPane";
import { useToast } from "@/components/shared/Toast";

interface LogViewerProps {
  runId: number;
  onClose: () => void;
}

export function LogViewer({ runId, onClose }: LogViewerProps) {
  const { segments, truncated, live, loaded, clear } = useRunLogs(runId);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();

  const clearLogs = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await apiClient.delete(`/api/runs/${runId}/logs`);
      if (res.status >= 200 && res.status < 300) {
        clear();
      } else {
        toast((res.data as { error?: string })?.error ?? "Failed to clear logs", "error");
      }
    } catch (err) {
      const message =
        axios.isAxiosError(err) && err.response?.data?.error
          ? String(err.response.data.error)
          : "Failed to clear logs";
      toast(message, "error");
    } finally {
      setClearing(false);
    }
  }, [runId, clearing, clear, toast]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-lg shadow-xl flex flex-col w-full max-w-4xl max-h-[80vh] border border-zinc-300 dark:border-zinc-700">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-300 dark:border-zinc-700">
          <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
            Run #{runId} {loaded && live && "(live)"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearLogs}
              disabled={clearing || segments.length === 0}
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
        <LogPane
          segments={segments}
          truncated={truncated}
          loaded={loaded}
          className="flex-1 p-4 text-sm"
        />
      </div>
    </div>
  );
}
