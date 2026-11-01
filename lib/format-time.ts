/** SQLite `datetime('now')` values are UTC without a zone marker ("YYYY-MM-DD HH:MM:SS"). */
export function parseDbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "just now", "5m ago", "3h ago", "2d ago", then a short date. */
export function relativeTime(date: Date | null, now: number = Date.now()): string {
  if (!date) return "never";
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Short duration between two dates ("4s", "3m 12s", "2h 5m"). */
export function duration(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return null;
  const s = Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
