"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
        Something went wrong
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-md">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 text-sm font-medium rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
      >
        Try again
      </button>
    </div>
  );
}
