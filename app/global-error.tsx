"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased">
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
          Something went wrong
        </h1>
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
      </body>
    </html>
  );
}
