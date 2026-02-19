import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => {
  class NextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;
    _cookies: Map<string, { value: string; options: Record<string, unknown> }>;

    constructor(
      body?: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
      this._cookies = new Map();
    }

    get cookies() {
      return {
        set: (name: string, value: string, options?: Record<string, unknown>) => {
          this._cookies.set(name, { value, options: options ?? {} });
        },
      };
    }

    static json(
      data: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      return new NextResponse(data, init);
    }
  }

  return { NextRequest: class {}, NextResponse };
});

import { createPulseAuthHandler } from "../createPulseAuthHandler";

const SECRET = "my-test-secret-that-is-long-enough";

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
    Object.entries(allHeaders).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method: opts.method ?? "POST",
    headers: { get: (key: string) => hdrs.get(key.toLowerCase()) ?? null },
    json: opts.jsonError
      ? () => Promise.reject(new SyntaxError("bad json"))
      : () => Promise.resolve(opts.body),
  };
}

describe("createPulseAuthHandler", () => {
  it("returns 200 and sets cookie on correct password", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ body: { password: SECRET } }));

    expect(resp.status).toBe(200);
    expect(resp.body).toEqual({ ok: true });

    const cookie = resp._cookies.get("pulse_auth");
    expect(cookie).toBeDefined();
    expect(cookie!.value).toMatch(/^[0-9a-f]+\.[0-9a-f]+$/);
    expect(cookie!.options.httpOnly).toBe(true);
    expect(cookie!.options.sameSite).toBe("lax");
    expect(cookie!.options.path).toBe("/");
  });

  it("returns 401 on wrong password", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ body: { password: "wrong" } }));

    expect(resp.status).toBe(401);
    expect(resp.body).toEqual({ error: "Incorrect password" });
  });

  it("returns 400 on missing password field", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ body: {} }));

    expect(resp.status).toBe(400);
    expect(resp.body).toEqual({ error: "Missing password" });
  });

  it("returns 400 on invalid JSON", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ jsonError: true }));

    expect(resp.status).toBe(400);
    expect(resp.body).toEqual({ error: "Invalid JSON" });
  });

  it("clears cookie on DELETE", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ method: "DELETE" }));

    expect(resp.status).toBe(200);
    const cookie = resp._cookies.get("pulse_auth");
    expect(cookie).toBeDefined();
    expect(cookie!.value).toBe("");
    expect(cookie!.options.maxAge).toBe(0);
  });

  it("returns 405 on unsupported method", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const resp: any = await handler(makeReq({ method: "GET" }));

    expect(resp.status).toBe(405);
  });

  it("returns 429 after 5 login attempts from same IP", async () => {
    const handler = createPulseAuthHandler({ secret: SECRET });
    const ip = "10.200.200.200";

    for (let i = 0; i < 5; i++) {
      const resp: any = await handler(
        makeReq({
          headers: { "x-forwarded-for": ip },
          body: { password: "wrong" },
        }),
      );
      expect(resp.status).toBe(401);
    }

    // 6th attempt should be rate limited
    const resp: any = await handler(
      makeReq({
        headers: { "x-forwarded-for": ip },
        body: { password: "wrong" },
      }),
    );
    expect(resp.status).toBe(429);
    expect(resp.body).toEqual({ error: "Too many login attempts" });
  });
});
