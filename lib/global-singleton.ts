/**
 * Process-wide singleton keyed on globalThis.
 *
 * The custom server (loaded by tsx) and Next.js route handlers (bundled by Next)
 * import the same modules as *separate module instances* inside one Node process.
 * Module-level state (PID maps, observers, socket clients, DB handle) would otherwise
 * be duplicated, so e.g. a run started over HTTP would never be broadcast over Socket.IO.
 * Keying state on globalThis makes both instances share it (and survives dev HMR).
 */
export function globalSingleton<T>(key: string, init: () => T): T {
  const g = globalThis as unknown as Record<string, unknown>;
  const fullKey = `__launcher_${key}`;
  if (!(fullKey in g)) {
    g[fullKey] = init();
  }
  return g[fullKey] as T;
}
