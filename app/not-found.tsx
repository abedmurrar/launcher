import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
        404 – Page not found
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center max-w-md">
        This page doesn’t exist or was moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-sm font-medium rounded bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
      >
        Back to Launcher
      </Link>
    </div>
  );
}
