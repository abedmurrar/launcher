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
}

/** Distance from the bottom (px) within which we keep auto-scrolling. */
const STICKY_THRESHOLD_PX = 40;

/**
 * Renders log segments and auto-scrolls only while the user is at the bottom,
 * so scrolling up to read isn't interrupted by new output.
 */
export function LogPane({ segments, truncated, loaded, className }: LogPaneProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const stickRef = useRef(true);

  const onScroll = () => {
    const el = preRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD_PX;
  };

  useLayoutEffect(() => {
    const el = preRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [segments]);

  return (
    <pre
      ref={preRef}
      onScroll={onScroll}
      className={`overflow-auto font-mono whitespace-pre-wrap break-all text-zinc-800 dark:text-zinc-200 ${className ?? ""}`}
    >
      {truncated && (
        <span className="block mb-2 text-zinc-500 italic">
          … earlier output not shown (showing the most recent output only)
        </span>
      )}
      {!loaded && segments.length === 0 && <span className="text-zinc-500">Loading…</span>}
      {segments.map((s) => (
        <Segment key={s.id} segment={s} />
      ))}
    </pre>
  );
}
