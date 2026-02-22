export default function Loading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div
        className="size-8 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-800 dark:border-t-zinc-200"
        aria-hidden
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
