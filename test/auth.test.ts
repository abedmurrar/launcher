import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  gateRequest,
  hasValidSession,
  safeEqual,
  safeNextPath,
  sessionCookie,
  sessionValue,
  unsafeBindingError,
} from "@/lib/auth";
import { rejectUnauthorized } from "@/server/auth";
import { startSocketServer } from "./helpers";

const TOKEN = "s3cret-token";
const goodCookie = `${SESSION_COOKIE}=${sessionValue(TOKEN)}`;

describe("auth helpers", () => {
  it("compares tokens safely", () => {
    expect(safeEqual(TOKEN, TOKEN)).toBe(true);
    expect(safeEqual(TOKEN, "nope")).toBe(false);
    expect(safeEqual("", TOKEN)).toBe(false);
  });

  it("session cookie never contains the token", () => {
    expect(sessionCookie(TOKEN)).not.toContain(TOKEN);
    expect(sessionCookie(TOKEN)).toMatch(/HttpOnly; SameSite=Strict/);
    expect(hasValidSession(`a=1; ${goodCookie}`, TOKEN)).toBe(true);
    expect(hasValidSession(`${SESSION_COOKIE}=${sessionValue("other")}`, TOKEN)).toBe(false);
    expect(hasValidSession(undefined, TOKEN)).toBe(false);
  });

  it("gates requests only when a token is configured", () => {
    expect(gateRequest("/", undefined, null)).toBe("allow");
    expect(gateRequest("/", undefined, TOKEN)).toBe("redirect");
    expect(gateRequest("/api/commands", undefined, TOKEN)).toBe("unauthorized");
    expect(gateRequest("/ws/", undefined, TOKEN)).toBe("unauthorized");
    expect(gateRequest("/login", undefined, TOKEN)).toBe("allow");
    expect(gateRequest("/api/login", undefined, TOKEN)).toBe("allow");
    expect(gateRequest("/_next/static/chunk.js", undefined, TOKEN)).toBe("allow");
    expect(gateRequest("/api/commands", goodCookie, TOKEN)).toBe("allow");
  });

  it("only redirects to same-site paths after login", () => {
    expect(safeNextPath("/groups?x=1")).toBe("/groups?x=1");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });

  it("refuses non-loopback binding without auth unless explicitly allowed", () => {
    expect(unsafeBindingError("127.0.0.1", null, false)).toBeNull();
    expect(unsafeBindingError("localhost", null, false)).toBeNull();
    expect(unsafeBindingError("0.0.0.0", null, false)).toMatch(/LAUNCHER_TOKEN/);
    expect(unsafeBindingError("0.0.0.0", TOKEN, false)).toBeNull();
    expect(unsafeBindingError("0.0.0.0", null, true)).toBeNull();
  });
});

describe("HTTP gate", () => {
  let server: http.Server;
  let base: string;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (rejectUnauthorized(req, res, TOKEN)) return;
      res.end("ok");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("rejects API calls and redirects pages without a session", async () => {
    const api = await fetch(`${base}/api/commands`);
    expect(api.status).toBe(401);
    const page = await fetch(`${base}/groups?tab=1`, { redirect: "manual" });
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe(`/login?next=${encodeURIComponent("/groups?tab=1")}`);
    expect((await fetch(`${base}/login`)).status).toBe(200);
  });

  it("allows requests with a valid session cookie", async () => {
    const res = await fetch(`${base}/api/commands`, { headers: { Cookie: goodCookie } });
    expect(res.status).toBe(200);
  });
});

describe("Socket.IO handshake", () => {
  it("rejects without a session and accepts with one", async () => {
    const srv = await startSocketServer({ token: TOKEN });
    try {
      await expect(srv.connect()).rejects.toThrow("unauthorized");
      const socket = await srv.connect({ cookie: goodCookie });
      expect(socket.connected).toBe(true);
    } finally {
      await srv.close();
    }
  });
});
