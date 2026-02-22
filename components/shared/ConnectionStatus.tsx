"use client";

/**
 * Presentational: connection loading or error state.
 * Used by CommandList and GroupList containers.
 */
export function ConnectionStatus({
  initialLoadDone,
  connectionError,
  children,
}: {
  initialLoadDone: boolean;
  connectionError: boolean;
  children: React.ReactNode;
}) {
  if (!initialLoadDone) {
    if (connectionError) {
      return (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-800 dark:text-amber-200">
          <p className="font-medium">Socket.IO didn’t connect</p>
          <p className="mt-1 text-sm">
            Start the app with the custom server so Socket.IO is available:{" "}
            <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5">npm run dev</code>
          </p>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            In the terminal you should see{" "}
            <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1">[socket.io] client connected</code> when it works.
            In the browser console you’ll see{" "}
            <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1">[socket.io] connecting to …</code> and{" "}
            <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1">[socket.io] connected</code> or{" "}
            <code className="rounded bg-amber-100 dark:bg-amber-900/50 px-1">[socket.io] connect_error</code>.
          </p>
        </div>
      );
    }
    return <p className="text-zinc-500">Connecting…</p>;
  }
  return <>{children}</>;
}
