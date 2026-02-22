import { NextRequest, NextResponse } from "next/server";
import { verifyPulseToken } from "@pulsekit/core";
import type { PulseHandlerConfig } from "./types";
import { createRateLimiter } from "./rateLimit";

const MAX_META_SIZE = 4096;
const VALID_EVENT_TYPES = new Set([
  "pageview",
  "custom",
  "vitals",
  "error",
  "server_error",
]);

interface ParsedEvent {
  type: string;
  path: string;
  sessionId?: string;
  meta?: Record<string, unknown>;
  siteId?: string;
}

function parseEvent(
  data: unknown
): { success: true; data: ParsedEvent } | { success: false } {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { success: false };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.type !== "string" || !VALID_EVENT_TYPES.has(obj.type)) {
    return { success: false };
  }

  if (typeof obj.path !== "string" || obj.path.length < 1 || obj.path.length > 2048) {
    return { success: false };
  }

  if (obj.sessionId !== undefined) {
    if (typeof obj.sessionId !== "string" || obj.sessionId.length < 1 || obj.sessionId.length > 128) {
      return { success: false };
    }
  }

  if (obj.meta !== undefined) {
    if (typeof obj.meta !== "object" || obj.meta === null || Array.isArray(obj.meta)) {
      return { success: false };
    }
    if (JSON.stringify(obj.meta).length > MAX_META_SIZE) {
      return { success: false };
    }
  }

  if (obj.siteId !== undefined) {
    if (typeof obj.siteId !== "string" || obj.siteId.length > 128) {
      return { success: false };
    }
  }

  return {
    success: true,
    data: {
      type: obj.type,
      path: obj.path,
      sessionId: obj.sessionId as string | undefined,
      meta: obj.meta as Record<string, unknown> | undefined,
      siteId: obj.siteId as string | undefined,
    },
  };
}

function withCors(resp: NextResponse, origin: string | null): NextResponse {
  if (origin) resp.headers.set("Access-Control-Allow-Origin", origin);
  return resp;
}

function isOriginAllowed(
  origin: string,
  allowedOrigins: string[]
): boolean {
  return allowedOrigins.some((allowed) => {
    if (allowed === "*") return true;
    // Exact match or wildcard subdomain (*.example.com)
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      try {
        const hostname = new URL(origin).hostname;
        return hostname === domain || hostname.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    }
    return origin === allowed;
  });
}

/**
 * Create a Next.js API route handler that ingests analytics events into
 * Supabase. Supports CORS, origin validation, rate limiting, and optional
 * ingestion-token authentication.
 *
 * @example
 * ```ts
 * const handler = createPulseHandler({ supabase });
 * export const POST = handler;
 * ```
 */
export function createPulseHandler({ supabase, config }: PulseHandlerConfig) {
  const maxRequests = config?.rateLimit ?? 30;
  const windowMs = (config?.rateLimitWindow ?? 60) * 1000;
  const isRateLimited = createRateLimiter(maxRequests, windowMs);

  return async function handler(req: NextRequest) {
    const origin = req.headers.get("origin") ?? "";
    let corsOrigin: string | null = null;

    // Origin validation
    if (config?.allowedOrigins) {
      if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
        corsOrigin = config.allowedOrigins.includes("*") ? "*" : origin;
      } else if (origin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-pulse-token",
        "Access-Control-Max-Age": "86400",
      };
      if (corsOrigin) headers["Access-Control-Allow-Origin"] = corsOrigin;
      return new NextResponse(null, { status: 204, headers });
    }

    if (req.method !== "POST") {
      return withCors(new NextResponse("Method Not Allowed", { status: 405 }), corsOrigin);
    }

    // Ingestion token validation
    if (config?.secret) {
      const token = req.headers.get("x-pulse-token");
      if (!token || !(await verifyPulseToken(config.secret, token))) {
        return withCors(NextResponse.json({ error: "Forbidden" }, { status: 403 }), corsOrigin);
      }
    }

    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return withCors(
        NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(config?.rateLimitWindow ?? 60) } }
        ),
        corsOrigin
      );
    }

    let json;
    try {
      json = await req.json();
    } catch {
      return withCors(NextResponse.json({ error: "Invalid JSON" }, { status: 400 }), corsOrigin);
    }

    const parse = parseEvent(json);
    if (!parse.success) {
      return withCors(NextResponse.json({ error: "Invalid payload" }, { status: 400 }), corsOrigin);
    }

    const event = parse.data;

    // Skip ignored paths
    if (config?.ignorePaths?.includes(event.path)) {
      return withCors(NextResponse.json({ ok: true }), corsOrigin);
    }

    const siteId = event.siteId ?? config?.siteId ?? "default";

    // Vercel provides these headers for free on all plans
    const country = req.headers.get("x-vercel-ip-country") ?? null;
    const region = req.headers.get("x-vercel-ip-country-region") ?? null;
    const cityRaw = req.headers.get("x-vercel-ip-city");
    const city = cityRaw ? decodeURIComponent(cityRaw) : null;
    const timezone = req.headers.get("x-vercel-ip-timezone") ?? null;
    const latRaw = req.headers.get("x-vercel-ip-latitude");
    const lngRaw = req.headers.get("x-vercel-ip-longitude");
    const latitude = latRaw ? parseFloat(latRaw) : null;
    const longitude = lngRaw ? parseFloat(lngRaw) : null;

    try {
      const { error } = await supabase
        .schema("analytics")
        .from("pulse_events")
        .insert({
          site_id: siteId,
          session_id: event.sessionId ?? null,
          path: event.path,
          event_type: event.type,
          meta: event.meta ?? null,
          country,
          region,
          city,
          timezone,
          latitude,
          longitude,
        });

      if (error) throw error;
    } catch (e) {
      config?.onError?.(e);
      return withCors(
        NextResponse.json({ error: "Failed to log event" }, { status: 500 }),
        corsOrigin
      );
    }

    return withCors(NextResponse.json({ ok: true }), corsOrigin);
  };
}
