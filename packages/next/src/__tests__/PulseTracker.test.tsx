/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { renderHook, cleanup } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────

// Mock web-vitals: capture callbacks so we can trigger them in tests
const vitalCallbacks: Record<string, (metric: { value: number }) => void> = {};
vi.mock("web-vitals", () => ({
  onLCP: (cb: (m: { value: number }) => void) => {
    vitalCallbacks.lcp = cb;
  },
  onINP: (cb: (m: { value: number }) => void) => {
    vitalCallbacks.inp = cb;
  },
  onCLS: (cb: (m: { value: number }) => void) => {
    vitalCallbacks.cls = cb;
  },
  onFCP: (cb: (m: { value: number }) => void) => {
    vitalCallbacks.fcp = cb;
  },
  onTTFB: (cb: (m: { value: number }) => void) => {
    vitalCallbacks.ttfb = cb;
  },
}));

// We import PulseTracker as a hook-wrapper so we can test its effects
// Since PulseTracker is a component that returns null and only has side effects,
// we wrap it in renderHook to trigger its useEffect hooks.
import { PulseTracker, type PulseTrackerProps } from "../PulseTracker";

// ── Helpers ──────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>;
let sendBeaconSpy: ReturnType<typeof vi.fn>;
const sessionStore = new Map<string, string>();

function renderTracker(props: Partial<PulseTrackerProps> = {}) {
  const Wrapper = () => React.createElement(PulseTracker, props);
  return renderHook(() => {}, { wrapper: Wrapper });
}

beforeEach(() => {
  // Clear vital callbacks
  for (const key in vitalCallbacks) delete vitalCallbacks[key];

  // Mock fetch
  fetchSpy = vi.fn().mockResolvedValue({ ok: true });
  globalThis.fetch = fetchSpy;

  // Mock sendBeacon
  sendBeaconSpy = vi.fn().mockReturnValue(true);
  Object.defineProperty(navigator, "sendBeacon", {
    value: sendBeaconSpy,
    writable: true,
    configurable: true,
  });

  // Mock sessionStorage
  sessionStore.clear();
  Object.defineProperty(window, "sessionStorage", {
    value: {
      getItem: (key: string) => sessionStore.get(key) ?? null,
      setItem: (key: string, val: string) => sessionStore.set(key, val),
      removeItem: (key: string) => sessionStore.delete(key),
      clear: () => sessionStore.clear(),
    },
    writable: true,
    configurable: true,
  });

  // Mock crypto.randomUUID
  let uuidCounter = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: () => `test-uuid-${++uuidCounter}`,
    writable: true,
    configurable: true,
  });

  // Mock location
  Object.defineProperty(window, "location", {
    value: { pathname: "/test-page" },
    writable: true,
    configurable: true,
  });

  // Reset document.cookie
  document.cookie = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("PulseTracker", () => {
  it("sends a pageview on mount", async () => {
    renderTracker();
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/pulse",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"type":"pageview"'),
        }),
      );
    });
  });

  it("includes pathname in pageview body", async () => {
    renderTracker();
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const call = fetchSpy.mock.calls.find(
      (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes("pageview"),
    );
    const body = JSON.parse(call[1].body);
    expect(body.path).toBe("/test-page");
    expect(body.sessionId).toMatch(/^test-uuid-/);
  });

  it("uses custom endpoint", async () => {
    renderTracker({ endpoint: "/custom/endpoint" });
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/custom/endpoint",
        expect.anything(),
      );
    });
  });

  it("skips pageview for excluded paths", async () => {
    renderTracker({ excludePaths: ["/test-page"] });
    // Wait a tick so effects run
    await new Promise((r) => setTimeout(r, 10));
    const pageviewCalls = fetchSpy.mock.calls.filter(
      (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes("pageview"),
    );
    expect(pageviewCalls).toHaveLength(0);
  });

  it("sends x-pulse-token header when token is provided", async () => {
    renderTracker({ token: "my-secret-token" });
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers["x-pulse-token"]).toBe("my-secret-token");
  });

  it("does not send x-pulse-token header when no token", async () => {
    renderTracker();
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const call = fetchSpy.mock.calls[0];
    expect(call[1].headers["x-pulse-token"]).toBeUndefined();
  });

  it("sets timezone cookie", async () => {
    renderTracker();
    await vi.waitFor(() => {
      expect(document.cookie).toContain("pulse_tz=");
    });
  });

  it("includes Secure flag on timezone cookie when on HTTPS", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/test-page", protocol: "https:" },
      writable: true,
      configurable: true,
    });
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderTracker();
    await vi.waitFor(() => {
      const tzWrite = cookieSpy.mock.calls.find((c) =>
        c[0].startsWith("pulse_tz="),
      );
      expect(tzWrite).toBeDefined();
      expect(tzWrite![0]).toContain("; Secure");
    });
    cookieSpy.mockRestore();
  });

  it("omits Secure flag on timezone cookie when on HTTP", async () => {
    Object.defineProperty(window, "location", {
      value: { pathname: "/test-page", protocol: "http:" },
      writable: true,
      configurable: true,
    });
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderTracker();
    await vi.waitFor(() => {
      const tzWrite = cookieSpy.mock.calls.find((c) =>
        c[0].startsWith("pulse_tz="),
      );
      expect(tzWrite).toBeDefined();
      expect(tzWrite![0]).not.toContain("Secure");
    });
    cookieSpy.mockRestore();
  });

  it("calls onError when pageview fetch fails", async () => {
    const onError = vi.fn();
    const networkError = new TypeError("Failed to fetch");
    fetchSpy.mockRejectedValue(networkError);
    renderTracker({ onError });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(networkError);
    });
  });

  it("does not throw when fetch fails and no onError is provided", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(() => renderTracker()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
  });

  it("persists session ID across calls via sessionStorage", async () => {
    renderTracker();
    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const storedId = sessionStore.get("pulse_session_id");
    expect(storedId).toBeDefined();
    expect(storedId).toMatch(/^test-uuid-/);
  });

  describe("web vitals", () => {
    it("sends vitals on visibilitychange to hidden", async () => {
      renderTracker();
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      // Simulate web vitals callbacks
      await vi.waitFor(() => expect(vitalCallbacks.lcp).toBeDefined());
      vitalCallbacks.lcp({ value: 2500 });
      vitalCallbacks.cls({ value: 0.1 });

      // Trigger visibilitychange
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // sendBeacon should have been called (no token, so sendBeacon path)
      expect(sendBeaconSpy).toHaveBeenCalledWith(
        "/api/pulse",
        expect.any(Blob),
      );
    });

    it("uses fetch instead of sendBeacon when token is provided", async () => {
      renderTracker({ token: "my-token" });
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      await vi.waitFor(() => expect(vitalCallbacks.lcp).toBeDefined());
      vitalCallbacks.lcp({ value: 2500 });

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Should use fetch, not sendBeacon (because token needs custom headers)
      const vitalsFetch = fetchSpy.mock.calls.find(
        (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes("vitals"),
      );
      expect(vitalsFetch).toBeDefined();
      expect(vitalsFetch[1].headers["x-pulse-token"]).toBe("my-token");
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });

    it("does not send vitals if no metrics collected", async () => {
      renderTracker();
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });

      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });
  });

  describe("error capture", () => {
    it("captures window errors and sends to endpoint", async () => {
      renderTracker();
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      const errorEvent = new ErrorEvent("error", {
        message: "Test error",
        filename: "test.js",
        lineno: 42,
        colno: 10,
        error: new Error("Test error"),
      });
      window.dispatchEvent(errorEvent);

      await vi.waitFor(() => {
        const errorCalls = fetchSpy.mock.calls.filter(
          (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes('"type":"error"'),
        );
        expect(errorCalls).toHaveLength(1);
        const body = JSON.parse(errorCalls[0][1].body);
        expect(body.meta.message).toBe("Test error");
        expect(body.meta.source).toBe("test.js");
        expect(body.meta.lineno).toBe(42);
      });
    });

    it("deduplicates errors with same fingerprint", async () => {
      renderTracker();
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      const makeError = () =>
        new ErrorEvent("error", {
          message: "Same error",
          filename: "test.js",
          lineno: 1,
        });

      window.dispatchEvent(makeError());
      window.dispatchEvent(makeError());
      window.dispatchEvent(makeError());

      await new Promise((r) => setTimeout(r, 10));
      const errorCalls = fetchSpy.mock.calls.filter(
        (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes('"type":"error"'),
      );
      expect(errorCalls).toHaveLength(1);
    });

    it("respects errorLimit", async () => {
      renderTracker({ errorLimit: 2 });
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      for (let i = 0; i < 5; i++) {
        window.dispatchEvent(
          new ErrorEvent("error", {
            message: `Error ${i}`,
            filename: "test.js",
            lineno: i,
          }),
        );
      }

      await new Promise((r) => setTimeout(r, 10));
      const errorCalls = fetchSpy.mock.calls.filter(
        (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes('"type":"error"'),
      );
      expect(errorCalls).toHaveLength(2);
    });

    it("does not capture errors when captureErrors is false", async () => {
      renderTracker({ captureErrors: false });
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      window.dispatchEvent(
        new ErrorEvent("error", { message: "Ignored error" }),
      );

      await new Promise((r) => setTimeout(r, 10));
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("calls onError when error reporting fetch fails", async () => {
      const onError = vi.fn();
      const networkError = new TypeError("Failed to fetch");
      fetchSpy.mockRejectedValue(networkError);
      renderTracker({ onError });

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Test error",
          filename: "test.js",
          lineno: 1,
        }),
      );

      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalledWith(networkError);
      });
    });

    it("captures unhandled promise rejections", async () => {
      renderTracker();
      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalled();
      });
      fetchSpy.mockClear();

      // PromiseRejectionEvent is not available in jsdom, dispatch a custom event
      const event = new Event("unhandledrejection") as any;
      event.reason = new Error("Promise failed");
      window.dispatchEvent(event);

      await vi.waitFor(() => {
        const errorCalls = fetchSpy.mock.calls.filter(
          (c: unknown[]) => typeof c[1]?.body === "string" && c[1].body.includes('"type":"error"'),
        );
        expect(errorCalls).toHaveLength(1);
        const body = JSON.parse(errorCalls[0][1].body);
        expect(body.meta.message).toBe("Promise failed");
      });
    });
  });
});
