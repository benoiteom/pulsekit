import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPulseToken } from "@pulsekit/core";

vi.mock("next/server", () => {
  class NextResponse {
    body: unknown;
    status: number;
    headers: Map<string, string>;

    constructor(
      body?: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
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

import { withPulseAuth } from "../withPulseAuth";

const SECRET = "test-secret-for-auth";

const innerHandler = vi.fn().mockImplementation(() => ({
  body: { ok: true },
  status: 200,
}));

function makeReq(opts: {
  cookie?: string;
  bearer?: string;
} = {}): any {
  const headers = new Map<string, string>();
  if (opts.bearer) {
    headers.set("authorization", `Bearer ${opts.bearer}`);
  }

  const cookies = new Map<string, { value: string }>();
  if (opts.cookie) {
    cookies.set("pulse_auth", { value: opts.cookie });
  }

  return {
    headers: { get: (key: string) => headers.get(key.toLowerCase()) ?? null },
    cookies: { get: (name: string) => cookies.get(name) ?? undefined },
  };
}

describe("withPulseAuth", () => {
  beforeEach(() => {
    innerHandler.mockClear();
  });

  afterEach(() => {
    delete process.env.PULSE_SECRET;
  });

  it("throws when PULSE_SECRET is not set", async () => {
    delete process.env.PULSE_SECRET;
    const handler = withPulseAuth(innerHandler);
    const req = makeReq();

    await expect(handler(req as any)).rejects.toThrow("PULSE_SECRET must be at least 16 characters");
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("returns 401 with no auth when PULSE_SECRET is set", async () => {
    process.env.PULSE_SECRET = SECRET;
    const handler = withPulseAuth(innerHandler);
    const resp: any = await handler(makeReq() as any);

    expect(resp.status).toBe(401);
    expect(resp.body).toEqual({ error: "Unauthorized" });
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("passes through with valid cookie token", async () => {
    process.env.PULSE_SECRET = SECRET;
    const token = await createPulseToken(SECRET, 60_000);
    const handler = withPulseAuth(innerHandler);
    await handler(makeReq({ cookie: token }) as any);

    expect(innerHandler).toHaveBeenCalledOnce();
  });

  it("returns 401 with invalid cookie token", async () => {
    process.env.PULSE_SECRET = SECRET;
    const handler = withPulseAuth(innerHandler);
    const resp: any = await handler(makeReq({ cookie: "bad.token" }) as any);

    expect(resp.status).toBe(401);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("passes through with valid Bearer token (secret)", async () => {
    process.env.PULSE_SECRET = SECRET;
    const handler = withPulseAuth(innerHandler);
    await handler(makeReq({ bearer: SECRET }) as any);

    expect(innerHandler).toHaveBeenCalledOnce();
  });

  it("returns 401 with wrong Bearer token", async () => {
    process.env.PULSE_SECRET = SECRET;
    const handler = withPulseAuth(innerHandler);
    const resp: any = await handler(
      makeReq({ bearer: "wrong-secret" }) as any,
    );

    expect(resp.status).toBe(401);
    expect(innerHandler).not.toHaveBeenCalled();
  });

  it("prefers cookie over Bearer", async () => {
    process.env.PULSE_SECRET = SECRET;
    const token = await createPulseToken(SECRET, 60_000);
    const handler = withPulseAuth(innerHandler);
    // Valid cookie + wrong bearer should still pass (cookie checked first)
    await handler(makeReq({ cookie: token, bearer: "wrong" }) as any);

    expect(innerHandler).toHaveBeenCalledOnce();
  });
});
