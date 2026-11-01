"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "@/context/ws";
import type { LiveLogChunk } from "@/context/ws";

type StreamType = "stdout" | "stderr";

export interface LogSegment {
  /** Stable key for rendering. */
  id: number;
  streamType: StreamType;
  text: string;
}

export interface RunLogsState {
  segments: LogSegment[];
  /** Older output is not shown (dropped by the server tail or the client cap). */
  truncated: boolean;
  /** Run is still producing output. */
  live: boolean;
  /** History has been received at least once. */
  loaded: boolean;
}

/** Client-side caps: keep the last ~2M characters / 4k segments. */
const MAX_CHARS = 2_000_000;
const MAX_SEGMENTS = 4_000;

/**
 * Subscribe to a run's logs. Output is merged into same-stream segments, capped in size,
 * de-duplicated against history by chunk id, and flushed to React at most once per frame.
 */
export function useRunLogs(runId: number) {
  const { subscribeToLogs, unsubscribeFromLogs } = useWs();
  const [state, setState] = useState<RunLogsState>({
    segments: [],
    truncated: false,
    live: true,
    loaded: false,
  });

  const segmentsRef = useRef<LogSegment[]>([]);
  const charsRef = useRef(0);
  const nextIdRef = useRef(0);
  const truncatedRef = useRef(false);
  const liveRef = useRef(true);
  const loadedRef = useRef(false);
  const historyLastIdRef = useRef<number | null>(null);
  const pendingBatchesRef = useRef<{ chunks: LiveLogChunk[]; lastId: number | undefined }[]>([]);
  const rafRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setState({
        segments: segmentsRef.current.slice(),
        truncated: truncatedRef.current,
        live: liveRef.current,
        loaded: loadedRef.current,
      });
    });
  }, []);

  const append = useCallback((streamType: StreamType, text: string) => {
    if (!text) return;
    const segs = segmentsRef.current;
    const last = segs[segs.length - 1];
    if (last && last.streamType === streamType) {
      // Replace (not mutate) so memoized rows re-render.
      segs[segs.length - 1] = { ...last, text: last.text + text };
    } else {
      segs.push({ id: nextIdRef.current++, streamType, text });
    }
    charsRef.current += text.length;

    while (segs.length > 1 && (charsRef.current > MAX_CHARS || segs.length > MAX_SEGMENTS)) {
      charsRef.current -= segs.shift()!.text.length;
      truncatedRef.current = true;
    }
    if (charsRef.current > MAX_CHARS && segs.length === 1) {
      const only = segs[0];
      segs[0] = { ...only, text: only.text.slice(only.text.length - MAX_CHARS) };
      charsRef.current = segs[0].text.length;
      truncatedRef.current = true;
    }
  }, []);

  const reset = useCallback(() => {
    segmentsRef.current = [];
    charsRef.current = 0;
    truncatedRef.current = false;
  }, []);

  useEffect(() => {
    reset();
    liveRef.current = true;
    loadedRef.current = false;
    historyLastIdRef.current = null;
    pendingBatchesRef.current = [];
    flush();

    const applyBatch = (chunks: LiveLogChunk[]) => {
      for (const c of chunks) append(c.streamType, c.data);
    };

    subscribeToLogs(runId, {
      onHistory: (chunks, meta) => {
        reset();
        for (const c of chunks) append(c.stream_type === "stderr" ? "stderr" : "stdout", c.content);
        truncatedRef.current = truncatedRef.current || meta.truncated;
        historyLastIdRef.current = meta.lastId;
        // Live batches that raced ahead of the history: keep only ones not already in it.
        for (const b of pendingBatchesRef.current) {
          if (b.lastId === undefined || b.lastId > meta.lastId) applyBatch(b.chunks);
        }
        pendingBatchesRef.current = [];
        liveRef.current = meta.live;
        loadedRef.current = true;
        flush();
      },
      onBatch: (chunks, lastId) => {
        const historyLastId = historyLastIdRef.current;
        if (historyLastId === null) {
          pendingBatchesRef.current.push({ chunks, lastId });
          return;
        }
        if (lastId !== undefined && lastId <= historyLastId) return;
        applyBatch(chunks);
        flush();
      },
      onFinished: () => {
        liveRef.current = false;
        flush();
      },
    });

    return () => {
      unsubscribeFromLogs(runId);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [runId, subscribeToLogs, unsubscribeFromLogs, append, reset, flush]);

  /** Drop everything currently shown (e.g. after clearing logs on the server). */
  const clear = useCallback(() => {
    reset();
    flush();
  }, [reset, flush]);

  return { ...state, clear };
}
