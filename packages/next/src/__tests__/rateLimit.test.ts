import { describe, it, expect, vi } from "vitest";
import { createRateLimiter } from "../rateLimit";

describe("createRateLimiter", () => {
  it("allows requests within the limit", () => {
    const limiter = createRateLimiter(3, 60_000);

    expect(limiter("ip-1")).toBe(false);
    expect(limiter("ip-1")).toBe(false);
    expect(limiter("ip-1")).toBe(false);
  });

  it("blocks requests exceeding the limit", () => {
    const limiter = createRateLimiter(2, 60_000);

    expect(limiter("ip-1")).toBe(false);
    expect(limiter("ip-1")).toBe(false);
    expect(limiter("ip-1")).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter(1, 60_000);

    expect(limiter("ip-1")).toBe(false);
    expect(limiter("ip-2")).toBe(false);
    expect(limiter("ip-1")).toBe(true);
    expect(limiter("ip-2")).toBe(true);
  });

  it("allows requests again after the window expires", () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(1, 1_000);

      expect(limiter("ip-1")).toBe(false);
      expect(limiter("ip-1")).toBe(true);

      vi.advanceTimersByTime(1_001);

      expect(limiter("ip-1")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("prunes expired entries when triggered by time interval", () => {
    vi.useFakeTimers();
    try {
      const limiter = createRateLimiter(1, 1_000);

      // Create entries for many IPs
      for (let i = 0; i < 100; i++) {
        limiter(`ip-${i}`);
      }

      // Advance past window + prune interval (30s)
      vi.advanceTimersByTime(31_000);

      // Next call triggers prune; should not throw or behave incorrectly
      expect(limiter("ip-new")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
