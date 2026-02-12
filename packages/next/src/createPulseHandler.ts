import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { PulseHandlerConfig } from "./types";

const EventSchema = z.object({
  type: z.enum(["pageview", "custom", "vitals"]),
  path: z.string().min(1),
  sessionId: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
  siteId: z.string().optional(),
});

export function createPulseHandler({ supabase, config }: PulseHandlerConfig) {
  return async function handler(req: NextRequest) {
    if (req.method !== "POST") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }

    const origin = req.headers.get("origin") ?? "";
    const referer = req.headers.get("referer") ?? "";
    const isLocalhost =
      origin.includes("localhost") || referer.includes("localhost");

    if (!isLocalhost || config?.allowLocalhost === false) {
      // TODO: configurable host checks in Week 2
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
      console.error(e);
      return NextResponse.json(
        { error: "Failed to log event" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  };
}
