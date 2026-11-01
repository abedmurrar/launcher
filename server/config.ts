function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const dev = process.env.NODE_ENV !== "production";
export const port = envInt("PORT", 9555);
/**
 * Bind address. Defaults to loopback: the app runs arbitrary shell commands with no auth,
 * so exposing it on the LAN must be an explicit opt-in (HOST=0.0.0.0).
 */
export const host = process.env.HOST?.trim() || "127.0.0.1";
/** Socket.IO path (same URL as before for compatibility). */
export const SOCKET_IO_PATH = "/ws";
