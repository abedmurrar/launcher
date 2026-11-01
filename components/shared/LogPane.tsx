"use client";

import { memo, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import type { LogSegment } from "@/hooks/useRunLogs";
import { ansiColorCss, parseAnsi, styleKey, type AnsiSpan, type AnsiStyle } from "@/lib/ansi";

function spanStyle(style: AnsiStyle): CSSProperties {
  const css: CSSProperties = {};
  let fg = style.fg !== undefined ? ansiColorCss(style.fg) : undefined;
  let bg = style.bg !== undefined ? ansiColorCss(style.bg) : undefined;
  if (style.inverse) {
    // Swap; defaults are the log background and the normal text color.
    [fg, bg] = [bg ?? "var(--log-bg)", fg ?? "var(--foreground)"];
  }
  if (fg) css.color = fg;
  if (bg) css.backgroundColor = bg;
  if (style.bold) css.fontWeight = 600;
  if (style.dim) css.opacity = 0.6;
  if (style.italic) css.fontStyle = "italic";
  const decorations = [style.underline && "underline", style.strike && "line-through"].filter(Boolean);
  if (decorations.length) css.textDecoration = decorations.join(" ");
  return css;
}

const Segment = memo(function Segment({
  streamType,
  spans,
  text,
}: {
  streamType: LogSegment["streamType"];
  spans: AnsiSpan[];
  text: string;
}) {
  // Segments that end at a line boundary render as their own block, so appending output only
  // re-lays out the last block instead of the whole log; off-screen blocks skip layout/paint.
  const isBlock = text.endsWith("\n");
  let style: CSSProperties | undefined;
  if (isBlock) {
    let lines = 0;
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lines++;
    style = { display: "block", contentVisibility: "auto", containIntrinsicSize: `auto ${Math.max(1, lines) * 1.65}em` };
  }
  return (
    <span className={streamType === "stderr" ? "text-red-600 dark:text-red-400" : undefined} style={style}>
      {spans.map((span, i) =>
        span.style ? (
          <span key={i} style={spanStyle(span.style)}>
            {span.text}
          </span>
        ) : (
          span.text
        )
      )}
    </span>
  );
});

interface ParsedSegment {
  inKey: string;
  spans: AnsiSpan[];
  end: AnsiStyle;
}

/** Parse results per segment object (segments are immutable; changed ones are new objects). */
const parseCache = new WeakMap<LogSegment, ParsedSegment>();

/** Parse ANSI colors segment by segment, carrying the style across segment boundaries. */
function useParsedSegments(segments: LogSegment[]) {
  return useMemo(() => {
    const out: { segment: LogSegment; spans: AnsiSpan[] }[] = [];
    let state: AnsiStyle = {};
    for (const segment of segments) {
      const inKey = styleKey(state);
      let parsed = parseCache.get(segment);
      if (!parsed || parsed.inKey !== inKey) {
        const result = parseAnsi(segment.text, state);
        parsed = { inKey, spans: result.spans, end: result.end };
        parseCache.set(segment, parsed);
      }
      state = parsed.end;
      out.push({ segment, spans: parsed.spans });
    }
    return out;
  }, [segments]);
}

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
  const parsed = useParsedSegments(segments);
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
      {parsed.map(({ segment, spans }) => (
        <Segment key={segment.id} streamType={segment.streamType} spans={spans} text={segment.text} />
      ))}
    </pre>
  );
}
