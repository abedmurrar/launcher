import type { IncomingMessage, ServerResponse } from "http";
import type { Server } from "socket.io";
import { gateRequest, hasValidSession, safeNextPath } from "../lib/auth";

/**
 * HTTP gate in front of Next. Returns true if the request was handled (rejected/redirected).
 */
export function rejectUnauthorized(req: IncomingMessage, res: ServerResponse, token: string | null): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  const decision = gateRequest(url.pathname, req.headers.cookie, token);
  if (decision === "allow") return false;
  if (decision === "unauthorized") {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
  } else {
    const next = safeNextPath(url.pathname + url.search);
    res.writeHead(302, { Location: `/login?next=${encodeURIComponent(next)}` });
    res.end();
  }
  return true;
}

/** Require a valid session cookie on the Socket.IO handshake when auth is enabled. */
export function applySocketAuth(io: Server, token: string | null): void {
  if (!token) return;
  io.use((socket, next) => {
    if (hasValidSession(socket.handshake.headers.cookie, token)) return next();
    next(new Error("unauthorized"));
  });
}
