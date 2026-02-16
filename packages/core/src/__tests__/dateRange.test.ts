import { describe, it, expect, vi, afterEach } from "vitest";
import { dateRangeFromTimeframe } from "../queries";

// Pin system timezone to UTC so Date parsing inside dateRangeFromTimeframe
// (which re-parses a toLocaleString result) behaves deterministically.
process.env.TZ = "UTC";

describe("dateRangeFromTimeframe", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a 7-day range ending today for "7d"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

    const result = dateRangeFromTimeframe("7d", "UTC");
    expect(result).toEqual({ startDate: "2025-01-09", endDate: "2025-01-15" });
  });

  it('returns a 30-day range ending today for "30d"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

    const result = dateRangeFromTimeframe("30d", "UTC");
    expect(result).toEqual({ startDate: "2024-12-17", endDate: "2025-01-15" });
  });

  it("passes custom { from, to } through as-is", () => {
    const result = dateRangeFromTimeframe(
      { from: "2025-01-01", to: "2025-01-10" },
      "UTC"
    );
    expect(result).toEqual({ startDate: "2025-01-01", endDate: "2025-01-10" });
  });

  it("produces different date boundaries for different timezones", () => {
    vi.useFakeTimers();
    // At 3 AM UTC on Jan 15, it's still Jan 14 in New York (UTC-5)
    vi.setSystemTime(new Date("2025-01-15T03:00:00Z"));

    const utc = dateRangeFromTimeframe("7d", "UTC");
    const ny = dateRangeFromTimeframe("7d", "America/New_York");

    expect(utc.endDate).toBe("2025-01-15");
    expect(ny.endDate).toBe("2025-01-14");

    expect(utc.startDate).toBe("2025-01-09");
    expect(ny.startDate).toBe("2025-01-08");
  });
});
