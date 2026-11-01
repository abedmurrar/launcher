"use client";

import { memo, useLayoutEffect, useRef } from "react";
import type { LogSegment } from "@/hooks/useRunLogs";

const Segment = memo(function Segment({ segment }: { segment: LogSegment }) {
  return (
    <span className={segment.streamType === "stderr" ? "text-red-600 dark:text-red-400" : undefined}>
      {segment.text}
    </span>
  );
});

interface LogPaneProps {
  segments: LogSegment[];
  truncated: boolean;
  loaded: boolean;
  className?: string;
  /** Run id, for the "open full log" link. */
  runId?: number;
  canLoadEarlier?: boolean;
  loadingEarlier?: boolean;
  onLoadEarlier?: () => void;
}

/** Distance from the bottom (px) within which we keep auto-scrolling. */
const STICKY_THRESHOLD_PX = 40;

/**
 * Renders log segments and auto-scrolls only while the user is at the bottom,
 * so scrolling up to read isn't interrupted by new output.
 */
export function LogPane({
  segments,
  truncated,
  loaded,
  className,
  runId,
  canLoadEarlier,
  loadingEarlier,
  onLoadEarlier,
}: LogPaneProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const stickRef = useRef(true);
  const prevFirstIdRef = useRef<number | undefined>(undefined);
  const prevHeightRef = useRef(0);

  const onScroll = () => {
    const el = preRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const el = preRef.current;
    if (!el) return;
    const firstId = segments[0]?.id;
    const prepended = prevFirstIdRef.current !== undefined && firstId !== prevFirstIdRef.current;
    if (stickRef.current) {
      el.scrollTop = el.scrollHeight;
    } else if (prepended) {
      // Older output was inserted above: keep the same lines in view.
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
    }
    prevFirstIdRef.current = firstId;
    prevHeightRef.current = el.scrollHeight;
  }, [segments]);

  return (
    <pre
      ref={preRef}
      onScroll={onScroll}
      className={`overflow-auto font-mono whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200 ${className ?? ""}`}
    >
      {truncated && (
        <span className="flex flex-wrap items-center gap-3 mb-2 text-zinc-500 italic font-sans text-xs">
          <span>… earlier output not shown</span>
          {canLoadEarlier && onLoadEarlier && (
            <button
              type="button"
              onClick={onLoadEarlier}
              disabled={loadingEarlier}
              className="not-italic px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 disabled:opacity-50"
            >
              {loadingEarlier ? "Loading…" : "Load earlier output"}
            </button>
          )}
          {runId != null && (
            <a
              href={`/api/runs/${runId}/logs?format=text`}
              target="_blank"
              rel="noreferrer"
              className="not-italic underline hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Open full log
            </a>
          )}
        </span>
      )}
      {!loaded && segments.length === 0 && <span className="text-zinc-500">Loading…</span>}
      {segments.map((s) => (
        <Segment key={s.id} segment={s} />
      ))}
    </pre>
  );
}
