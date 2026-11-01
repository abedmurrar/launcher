"use client";

import { useState } from "react";
import { OctagonX } from "lucide-react";
import { useWs } from "@/context/ws";
import { useToast } from "@/components/shared/Toast";
import { CommandAction } from "@/lib/ws-action-handlers/types";

/** Header button that stops every running group and command. Hidden when nothing runs. */
export function StopAllButton() {
  const { commands, groups, sendAction } = useWs();
  const { toast, confirm } = useToast();
  const [busy, setBusy] = useState(false);

  const runningCount = commands.filter((c) => c.running).length;
  if (runningCount === 0 && !groups.some((g) => g.running)) return null;

  const onClick = async () => {
    const label = runningCount === 1 ? "1 running command" : `${runningCount} running commands`;
    if (!(await confirm(`Stop ${label}?`, "Stop all"))) return;
    setBusy(true);
    try {
      const result = await sendAction(CommandAction.StopAll, {});
      if (!result.success) {
        toast(result.error ?? "Failed to stop all", "error");
        return;
      }
      const data = result.data as { stopped?: number; forced?: boolean } | undefined;
      toast(
        `Stopped ${data?.stopped ?? 0}${data?.forced ? " (some were force-killed)" : ""}`,
        "success"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      <OctagonX size={16} />
      <span className="hidden sm:inline">{busy ? "Stopping…" : `Stop all (${runningCount})`}</span>
    </button>
  );
}
