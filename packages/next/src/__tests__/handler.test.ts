import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => {
  class NextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;

    constructor(
      body?: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    static json(
      data: unknown,
      init?: { status?: number; headers?: Record<string, string> }
    ) {
      return new NextResponse(data, init);
    }
  }

  return { NextRequest: class {}, NextResponse };
});

import { createPulseHandler } from "../createPulseHandler";

// ── Helpers ─────────────────────────────────────────────────────────

let nextIp = 1;

function uniqueIp(): string {
  const ip = `10.0.${Math.floor(nextIp / 256)}.${nextIp % 256}`;
  nextIp++;
  return ip;
}

function makeReq(opts: {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  jsonError?: boolean;
}): any {
  const allHeaders: Record<string, string> = {
    "x-forwarded-for": uniqueIp(),
    ...opts.headers,
  };
  const hdrs = new Map(
    Object.entries(allHeaders).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method: opts.method ?? "POST",
    headers: { get: (key: string) => hdrs.get(key.toLowerCase()) ?? null },
    json: opts.jsonError
      ? () => Promise.reject(new SyntaxError("Unexpected token"))
      : () => Promise.resolve(opts.body),
  };
}

function mockSupabase(insertResult: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const client = {
    schema: () => ({ from: () => ({ insert }) }),
  };
  return { client, insert };
}

const validBody = { type: "pageview", path: "/test" };

// ── Tests ───────────────────────────────────────────────────────────

describe("createPulseHandler", () => {
  it("rejects non-POST with 405", async () => {
    const { client } = mockSupabase();
    const handler = createPulseHandler({ supabase: client as any });

    const resp: any = await handler(makeReq({ method: "GET" }));
    expect(resp.status).toBe(405);
    expect(resp.body).toBe("Method Not Allowed");
  });

  it("returns 403 when origin is not in allowedOrigins", async () => {
    const { client } = mockSupabase();
    const handler = createPulseHandler({
      supabase: client as any,
      config: { allowedOrigins: ["http://allowed.com"] },
    });

    const resp: any = await handler(
      makeReq({ headers: { origin: "http://evil.com" }, body: validBody })
    );
    expect(resp.status).toBe(403);
    expect(resp.body).toEqual({ error: "Forbidden" });
  });

  describe("allows requests when origin matches", () => {
    it("exact match", async () => {
      const { client } = mockSupabase();
      const handler = createPulseHandler({
        supabase: client as any,
        config: { allowedOrigins: ["http://example.com"] },
      });

      const resp: any = await handler(
        makeReq({
          headers: { origin: "http://example.com" },
          body: validBody,
        })
      );
      expect(resp.status).toBe(200);
    });

    it("wildcard *", async () => {
      const { client } = mockSupabase();
      const handler = createPulseHandler({
        supabase: client as any,
        config: { allowedOrigins: ["*"] },
      });

      const resp: any = await handler(
        makeReq({
          headers: { origin: "http://anything.com" },
          body: validBody,
        })
      );
      expect(resp.status).toBe(200);
    });

    it("subdomain wildcard *.example.com", async () => {
      const { client } = mockSupabase();
      const handler = createPulseHandler({
        supabase: client as any,
        config: { allowedOrigins: ["*.example.com"] },
      });

      const resp: any = await handler(
        makeReq({
          headers: { origin: "http://sub.example.com" },
          body: validBody,
        })
      );
      expect(resp.status).toBe(200);
    });
  });

  it("skips origin check when allowedOrigins is not configured", async () => {
    const { client } = mockSupabase();
    const handler = createPulseHandler({ supabase: client as any });

    const resp: any = await handler(
      makeReq({ headers: { origin: "http://any.com" }, body: validBody })
    );
    expect(resp.status).toBe(200);
  });

  it("returns 429 after exceeding rate limit", async () => {
    const { client } = mockSupabase();
    const ip = "10.99.99.99";
    const handler = createPulseHandler({
      supabase: client as any,
      config: { rateLimit: 2, rateLimitWindow: 60 },
    });

    const mkReq = () =>
      makeReq({ headers: { "x-forwarded-for": ip }, body: validBody });

    // First 2 requests should succeed
    expect(((await handler(mkReq())) as any).status).toBe(200);
    expect(((await handler(mkReq())) as any).status).toBe(200);

    // 3rd should be rate limited
    const resp: any = await handler(mkReq());
    expect(resp.status).toBe(429);
    expect(resp.body).toEqual({ error: "Too many requests" });
  });

  it("returns 400 for invalid JSON body", async () => {
    const { client } = mockSupabase();
    const handler = createPulseHandler({ supabase: client as any });

    const resp: any = await handler(makeReq({ jsonError: true }));
    expect(resp.status).toBe(400);
    expect(resp.body).toEqual({ error: "Invalid JSON" });
  });

  describe("returns 400 for invalid payload", () => {
    let handler: any;

    beforeEach(() => {
      const { client } = mockSupabase();
      handler = createPulseHandler({ supabase: client as any });
    });

    it("missing type", async () => {
      const resp: any = await handler(makeReq({ body: { path: "/" } }));
      expect(resp.status).toBe(400);
      expect(resp.body).toEqual({ error: "Invalid payload" });
    });

    it("empty path", async () => {
      const resp: any = await handler(
        makeReq({ body: { type: "pageview", path: "" } })
      );
      expect(resp.status).toBe(400);
    });

    it("path too long", async () => {
      const resp: any = await handler(
        makeReq({ body: { type: "pageview", path: "a".repeat(2049) } })
      );
      expect(resp.status).toBe(400);
    });

    it("meta too large", async () => {
      const resp: any = await handler(
        makeReq({
          body: {
            type: "pageview",
            path: "/",
            meta: { big: "x".repeat(5000) },
          },
        })
      );
      expect(resp.status).toBe(400);
    });

    it("bad event type", async () => {
      const resp: any = await handler(
        makeReq({ body: { type: "invalid", path: "/" } })
      );
      expect(resp.status).toBe(400);
    });
  });

  it("returns 200 and inserts event on valid payload", async () => {
    const { client, insert } = mockSupabase();
    const handler = createPulseHandler({
      supabase: client as any,
      config: { siteId: "my-site" },
    });

    const resp: any = await handler(makeReq({ body: validBody }));

    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "my-site",
        path: "/test",
        event_type: "pageview",
      })
    );
  });

  it("passes Vercel geo headers through to the insert", async () => {
    const { client, insert } = mockSupabase();
    const handler = createPulseHandler({ supabase: client as any });

    const resp: any = await handler(
      makeReq({
        headers: {
          "x-vercel-ip-country": "US",
          "x-vercel-ip-country-region": "CA",
          "x-vercel-ip-city": "San Francisco",
          "x-vercel-ip-timezone": "America/Los_Angeles",
          "x-vercel-ip-latitude": "37.7749",
          "x-vercel-ip-longitude": "-122.4194",
        },
        body: validBody,
      })
    );

    expect(resp.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        country: "US",
        region: "CA",
        city: "San Francisco",
        timezone: "America/Los_Angeles",
        latitude: 37.7749,
        longitude: -122.4194,
      })
    );
  });

  it("returns 500 when Supabase insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { client } = mockSupabase({
      error: { message: "DB error", code: "500" },
    });
    const handler = createPulseHandler({ supabase: client as any });

    const resp: any = await handler(makeReq({ body: validBody }));

    expect(resp.status).toBe(500);
    expect(resp.body).toEqual({ error: "Failed to log event" });

    consoleSpy.mockRestore();
  });
});
