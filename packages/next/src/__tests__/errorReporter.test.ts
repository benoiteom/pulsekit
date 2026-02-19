import { describe, it, expect, vi } from "vitest";
import { createPulseErrorReporter } from "../createPulseErrorReporter";

function mockSupabase(insertResult: { error: unknown } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const client = {
    schema: () => ({ from: () => ({ insert }) }),
  };
  return { client, insert };
}

const sampleError = {
  digest: "abc123",
  message: "Something broke",
  stack: "Error: Something broke\n    at handler (/app/page.tsx:10:5)",
};

const sampleRequest = {
  path: "/dashboard",
  method: "GET",
  headers: { host: "localhost:3000" },
};

const sampleContext = {
  routerKind: "App Router",
  routeType: "page",
  routePath: "/dashboard",
};

describe("createPulseErrorReporter", () => {
  it("inserts a server_error event into Supabase", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({ supabase: client as any });

    await reporter(sampleError, sampleRequest, sampleContext);

    expect(insert).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: "default",
        session_id: null,
        path: "/dashboard",
        event_type: "server_error",
        meta: expect.objectContaining({
          message: "Something broke",
          digest: "abc123",
          method: "GET",
          routerKind: "App Router",
          routeType: "page",
          routePath: "/dashboard",
        }),
      })
    );
  });

  it("uses custom siteId when provided", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({
      supabase: client as any,
      siteId: "my-site",
    });

    await reporter(sampleError, sampleRequest, sampleContext);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ site_id: "my-site" })
    );
  });

  it("truncates long error messages to 1024 chars", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({ supabase: client as any });

    const longError = {
      ...sampleError,
      message: "x".repeat(2000),
    };

    await reporter(longError, sampleRequest, sampleContext);

    const meta = insert.mock.calls[0][0].meta;
    expect(meta.message.length).toBe(1024);
  });

  it("truncates stack traces to 15 lines and 4096 chars", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({ supabase: client as any });

    const lines = Array.from({ length: 30 }, (_, i) => `    at fn${i} (file.ts:${i}:1)`);
    const longError = {
      ...sampleError,
      stack: `Error: fail\n${lines.join("\n")}`,
    };

    await reporter(longError, sampleRequest, sampleContext);

    const meta = insert.mock.calls[0][0].meta;
    const stackLines = meta.stack.split("\n");
    expect(stackLines.length).toBeLessThanOrEqual(15);
    expect(meta.stack.length).toBeLessThanOrEqual(4096);
  });

  it("sets stack to null when no stack is provided", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({ supabase: client as any });

    const noStackError = { digest: "abc", message: "oops" };

    await reporter(noStackError as any, sampleRequest, sampleContext);

    const meta = insert.mock.calls[0][0].meta;
    expect(meta.stack).toBeNull();
  });

  it("does not throw when Supabase insert fails", async () => {
    const { client } = mockSupabase({ error: { message: "DB down" } });
    const reporter = createPulseErrorReporter({ supabase: client as any });

    // Should not reject
    await expect(
      reporter(sampleError, sampleRequest, sampleContext)
    ).resolves.toBeUndefined();
  });

  it("does not throw when Supabase insert throws", async () => {
    const insert = vi.fn().mockRejectedValue(new Error("Connection lost"));
    const client = {
      schema: () => ({ from: () => ({ insert }) }),
    };
    const reporter = createPulseErrorReporter({ supabase: client as any });

    await expect(
      reporter(sampleError, sampleRequest, sampleContext)
    ).resolves.toBeUndefined();
  });

  it("handles missing message gracefully", async () => {
    const { client, insert } = mockSupabase();
    const reporter = createPulseErrorReporter({ supabase: client as any });

    const noMsgError = { digest: "abc" } as any;

    await reporter(noMsgError, sampleRequest, sampleContext);

    const meta = insert.mock.calls[0][0].meta;
    expect(meta.message).toBe("Unknown error");
  });
});
