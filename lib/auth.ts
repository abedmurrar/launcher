import crypto from "crypto";

/**
 * Optional shared-token auth (enabled when LAUNCHER_TOKEN is set).
 * The browser exchanges the token for an HttpOnly session cookie whose value is an HMAC of the
 * token, so the token itself is never stored client-side.
 */
export const SESSION_COOKIE = "launcher_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

export function getAuthToken(): string | null {
  return process.env.LAUNCHER_TOKEN?.trim() || null;
}

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

/** Constant-time string comparison (hashes first so lengths always match). */
export function safeEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256(a), sha256(b));
}

export function sessionValue(token: string): string {
  return crypto.createHmac("sha256", token).update("launcher-session-v1").digest("hex");
}

export function parseCookies(header: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  }
  return out;
}

export function hasValidSession(cookieHeader: string | undefined | null, token: string): boolean {
  const value = parseCookies(cookieHeader)[SESSION_COOKIE];
  return value != null && safeEqual(value, sessionValue(token));
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${sessionValue(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_S}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

/** Paths reachable without a session (login page/API and the static assets it needs). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/_next/image") ||
    // Next dev-mode HMR / assets
    pathname.startsWith("/_next/webpack-hmr") ||
    pathname.startsWith("/__nextjs")
  );
}

export type GateDecision = "allow" | "unauthorized" | "redirect";

/** Decide what to do with an HTTP request when auth may be enabled. */
export function gateRequest(
  pathname: string,
  cookieHeader: string | undefined | null,
  token: string | null
): GateDecision {
  if (!token || isPublicPath(pathname) || hasValidSession(cookieHeader, token)) return "allow";
  return pathname.startsWith("/api/") || pathname.startsWith("/ws") ? "unauthorized" : "redirect";
}

/** Only allow same-site relative redirect targets after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1" || host.startsWith("127.");
}

/** Error message if binding to `host` without auth is unsafe and not explicitly allowed. */
export function unsafeBindingError(host: string, token: string | null, allowInsecure: boolean): string | null {
  if (isLoopbackHost(host) || token || allowInsecure) return null;
  return (
    `Refusing to listen on ${host} without authentication: anyone who can reach this port could run ` +
    `shell commands. Set LAUNCHER_TOKEN=<secret> (recommended) or LAUNCHER_ALLOW_INSECURE=1.`
  );
}
