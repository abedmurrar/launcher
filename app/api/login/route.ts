import { NextRequest, NextResponse } from "next/server";
import { getAuthToken, safeEqual, sessionCookie } from "@/lib/auth";

/** POST { token } → sets the session cookie when it matches LAUNCHER_TOKEN. */
export async function POST(request: NextRequest) {
  const token = getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Authentication is not enabled" }, { status: 400 });
  }
  let supplied = "";
  try {
    const body = (await request.json()) as { token?: unknown };
    supplied = typeof body.token === "string" ? body.token : "";
  } catch {
    // fall through with empty token
  }
  if (!supplied || !safeEqual(supplied, token)) {
    // Small fixed delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
}
