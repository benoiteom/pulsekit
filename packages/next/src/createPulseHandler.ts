import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PulseHandlerConfig } from "./types";

const MAX_META_SIZE = 4096;

const EventSchema = z.object({
  type: z.enum(["pageview", "custom", "vitals", "error", "server_error"]),
  path: z.string().min(1).max(2048),
  sessionId: z.string().max(128).optional(),
  meta: z
    .record(z.unknown())
    .optional()
    .refine(
      (val) =>
        val === undefined || JSON.stringify(val).length <= MAX_META_SIZE,
      { message: `meta must be under ${MAX_META_SIZE} bytes when serialized` }
    ),
  siteId: z.string().max(128).optional(),
});

// Simple in-memory sliding window rate limiter
const ipHits = new Map<string, number[]>();

function isRateLimited(
  ip: string,
  maxRequests: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const hits = ipHits.get(ip) ?? [];

  // Evict timestamps outside the window
  const recent = hits.filter((t) => now - t < windowMs);
  recent.push(now);
  ipHits.set(ip, recent);

  // Periodically prune stale IPs to prevent memory leaks
  if (ipHits.size > 10_000) {
    for (const [key, timestamps] of ipHits) {
      if (timestamps.every((t) => now - t >= windowMs)) {
        ipHits.delete(key);
      }
    }
  }

  return recent.length > maxRequests;
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

export function createPulseHandler({ supabase, config }: PulseHandlerConfig) {
  const maxRequests = config?.rateLimit ?? 30;
  const windowMs = (config?.rateLimitWindow ?? 60) * 1000;

  return async function handler(req: NextRequest) {
    if (req.method !== "POST") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }

    // Origin validation
    if (config?.allowedOrigins) {
      const origin = req.headers.get("origin") ?? "";
      if (!isOriginAllowed(origin, config.allowedOrigins)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip, maxRequests, windowMs)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(config?.rateLimitWindow ?? 60) } }
      );
    }

    let json;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parse = EventSchema.safeParse(json);
    if (!parse.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const event = parse.data;
    const siteId = event.siteId ?? config?.siteId ?? "default";

    // Vercel provides these headers for free on all plans
    const country = req.headers.get("x-vercel-ip-country") ?? null;
    const region = req.headers.get("x-vercel-ip-country-region") ?? null;
    const city = req.headers.get("x-vercel-ip-city") ?? null;
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
      console.error("[pulsekit] Failed to log event:", e);
      return NextResponse.json(
        { error: "Failed to log event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  };
}
