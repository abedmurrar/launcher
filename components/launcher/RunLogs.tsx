"use client";

import { useCallback, useState } from "react";
import { Eraser } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useRunLogs } from "@/hooks/useRunLogs";
import { LogPane } from "@/components/shared/LogPane";
import { useToast } from "@/components/shared/Toast";

/** Output of one run: header (live badge, clear) + scrolling log pane. */
export function RunLogs({ runId, label = "Output" }: { runId: number; label?: string }) {
  const { segments, truncated, live, loaded, clear, canLoadEarlier, loadingEarlier, loadEarlier } =
    useRunLogs(runId);
  const [clearing, setClearing] = useState(false);
  const { toast } = useToast();

  const clearLogs = useCallback(async () => {
    setClearing(true);
    try {
      const res = await apiClient.delete(`/api/runs/${runId}/logs`);
      if (res.status >= 200 && res.status < 300) clear();
      else toast((res.data as { error?: string })?.error ?? "Failed to clear logs", "error");
    } catch {
      toast("Failed to clear logs", "error");
    } finally {
      setClearing(false);
    }
  }, [runId, clear, toast]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500">
        <span className="font-semibold uppercase tracking-wider">{label}</span>
        <span className="font-mono text-zinc-400">run #{runId}</span>
        {loaded && live && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-px text-emerald-700 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> live
          </span>
        )}
        <button
          type="button"
          onClick={clearLogs}
          disabled={clearing || segments.length === 0}
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-zinc-200/60 hover:text-zinc-800 disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          title="Clear this run's output"
        >
          <Eraser size={12} /> {clearing ? "Clearing…" : "Clear"}
        </button>
      </div>
      <LogPane
        segments={segments}
        truncated={truncated}
        loaded={loaded}
        runId={runId}
        canLoadEarlier={canLoadEarlier}
        loadingEarlier={loadingEarlier}
        onLoadEarlier={loadEarlier}
        className="mx-4 mb-4 flex-1 min-h-40 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed dark:border-zinc-800 dark:bg-black/40"
      />
    </div>
  );
}

export function NoRuns() {
  return (
    <div className="mx-4 mb-4 flex flex-1 min-h-40 items-center justify-center rounded-md border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700">
      No runs yet. Output appears here when it runs.
    </div>
  );
}
