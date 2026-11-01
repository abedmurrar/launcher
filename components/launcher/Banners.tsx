"use client";

import { useState } from "react";
import { History, WifiOff } from "lucide-react";
import type { RestoreOffer } from "@/context/ws";

export function RestoreBanner({
  offers,
  onRestore,
  onDismiss,
}: {
  offers: RestoreOffer[];
  onRestore: () => Promise<unknown>;
  onDismiss: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState<"restore" | "dismiss" | null>(null);
  if (offers.length === 0) return null;

  const rebooted = offers.some((o) => o.reason === "reboot");
  const what = offers.length === 1 ? "1 item was" : `${offers.length} items were`;
  const names = offers.map((o) => (o.kind === "group" ? `${o.name} (group)` : o.name)).join(", ");
  const run = async (kind: "restore" | "dismiss", fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
      <History size={16} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">
          {what} running {rebooted ? "before the machine restarted" : "when the launcher stopped"}.
        </span>{" "}
        <span className="text-sky-800/80 dark:text-sky-200/70">{names}</span>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy != null}
          onClick={() => run("restore", onRestore)}
          className="rounded-md bg-sky-600 px-3 py-1 text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {busy === "restore" ? "Restoring…" : "Restore"}
        </button>
        <button
          type="button"
          disabled={busy != null}
          onClick={() => run("dismiss", onDismiss)}
          className="rounded-md px-3 py-1 hover:bg-sky-100 disabled:opacity-50 dark:hover:bg-sky-900/50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function OfflineBanner({ since }: { since: number }) {
  const at = since ? new Date(since).toLocaleTimeString() : null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <WifiOff size={15} className="shrink-0" />
      <span>
        <span className="font-medium">Launcher offline.</span>{" "}
        {at ? `Showing the last known state from ${at}.` : "No state received yet."} Reconnecting…
      </span>
    </div>
  );
}
