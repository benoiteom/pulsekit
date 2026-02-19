import { NextRequest, NextResponse } from "next/server";
import { createPulseToken, timingSafeEqual } from "@pulsekit/core";
import { createRateLimiter } from "./rateLimit";

export interface PulseAuthHandlerConfig {
  secret: string;
  /** Cookie max-age in seconds. Defaults to 7 days. */
  cookieMaxAge?: number;
}

const SEVEN_DAYS = 7 * 24 * 60 * 60;

/**
 * Create a Next.js API route handler for dashboard authentication.
 * Validates a shared secret via `POST` (login) and clears the auth cookie
 * via `DELETE` (logout). Sets an `httpOnly` cookie on successful login.
 *
 * @example
 * ```ts
 * const handler = createPulseAuthHandler({ secret: process.env.PULSE_SECRET! });
 * export const POST = handler;
 * export const DELETE = handler;
 * ```
 */
export function createPulseAuthHandler({
  secret,
  cookieMaxAge = SEVEN_DAYS,
}: PulseAuthHandlerConfig) {
  if (!secret || secret.length < 16) {
    throw new Error(
      "[pulsekit] createPulseAuthHandler requires a secret of at least 16 characters. Set the PULSE_SECRET environment variable.",
    );
  }

  const isLoginRateLimited = createRateLimiter(5, 60_000);

  return async function handler(req: NextRequest) {
    if (req.method === "DELETE") {
      const resp = NextResponse.json({ ok: true });
      resp.cookies.set("pulse_auth", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return resp;
    }

    if (req.method !== "POST") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }

    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isLoginRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    let body: { password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.password || typeof body.password !== "string") {
      return NextResponse.json(
        { error: "Missing password" },
        { status: 400 },
      );
    }

    const match = await timingSafeEqual(body.password, secret);

    if (!match) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 },
      );
    }

    const token = await createPulseToken(secret, cookieMaxAge * 1000);

    const resp = NextResponse.json({ ok: true });
    resp.cookies.set("pulse_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: cookieMaxAge,
    });

    return resp;
  };
}
