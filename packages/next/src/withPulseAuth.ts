import { NextRequest, NextResponse } from "next/server";
import { verifyPulseToken, timingSafeEqual } from "@pulsekit/core";

type NextHandler = (
  req: NextRequest,
  ctx?: unknown,
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps a Next.js route handler with auth protection.
 *
 * Checks (in order):
 * 1. `pulse_auth` cookie — verified via HMAC token
 * 2. `Authorization: Bearer {secret}` header — direct comparison (for cron jobs)
 *
 * Requires `PULSE_SECRET` to be set — returns 500 if missing.
 */
export function withPulseAuth(handler: NextHandler): NextHandler {
  return async function authHandler(req: NextRequest, ctx?: unknown) {
    const secret = process.env.PULSE_SECRET;

    if (!secret || secret.length < 16) {
      throw new Error(
        "[pulsekit] PULSE_SECRET must be at least 16 characters. " +
        "Set it in your .env.local file to enable authentication.",
      );
    }

    // Check cookie
    const cookie = req.cookies.get("pulse_auth")?.value;
    if (cookie && (await verifyPulseToken(secret, cookie))) {
      return handler(req, ctx);
    }

    // Check Bearer token (timing-safe via HMAC comparison)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const bearer = authHeader.slice(7);
      if (await timingSafeEqual(bearer, secret)) {
        return handler(req, ctx);
      }
    }

    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  };
}
