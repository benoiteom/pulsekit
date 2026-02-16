import { describe, it, expect } from "vitest";
import { getPulseStats, getPulseVitals, getPulseErrors } from "../queries";

// Use custom timeframe objects to bypass dateRangeFromTimeframe date math
const timeframe = { from: "2025-01-01", to: "2025-01-07" };

function mockRpc(results: Record<string, { data: unknown; error: unknown }>) {
  return {
    schema: () => ({
      rpc: (name: string) => results[name] ?? { data: null, error: null },
    }),
  } as any;
}

// ── getPulseStats ──────────────────────────────────────────────────

describe("getPulseStats", () => {
  it("groups rows by date and sums views/visitors", async () => {
    const supabase = mockRpc({
      pulse_stats_by_timezone: {
        data: [
          { date: "2025-01-01", path: "/", total_views: "10", unique_visitors: "5" },
          { date: "2025-01-01", path: "/about", total_views: "3", unique_visitors: "2" },
          { date: "2025-01-02", path: "/", total_views: "15", unique_visitors: "8" },
        ],
        error: null,
      },
      pulse_location_stats: { data: [], error: null },
    });

    const stats = await getPulseStats({ supabase, siteId: "test", timeframe });

    expect(stats.daily).toEqual([
      { date: "2025-01-01", totalViews: 13, uniqueVisitors: 7 },
      { date: "2025-01-02", totalViews: 15, uniqueVisitors: 8 },
    ]);
  });

  it("sorts top pages by views desc and limits to 10", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      date: "2025-01-01",
      path: `/page-${i}`,
      total_views: String(120 - i * 10),
      unique_visitors: "1",
    }));

    const supabase = mockRpc({
      pulse_stats_by_timezone: { data: rows, error: null },
      pulse_location_stats: { data: [], error: null },
    });

    const stats = await getPulseStats({ supabase, siteId: "test", timeframe });

    expect(stats.topPages).toHaveLength(10);
    expect(stats.topPages[0]).toMatchObject({ path: "/page-0", totalViews: 120 });
    expect(stats.topPages[9]).toMatchObject({ path: "/page-9", totalViews: 30 });
  });

  it("maps location data with null handling", async () => {
    const supabase = mockRpc({
      pulse_stats_by_timezone: { data: [], error: null },
      pulse_location_stats: {
        data: [
          { country: "US", city: "NYC", latitude: 40.7, longitude: -74.0, total_views: "50", unique_visitors: "20" },
          { country: "DE", city: null, latitude: null, longitude: null, total_views: "10", unique_visitors: "5" },
        ],
        error: null,
      },
    });

    const stats = await getPulseStats({ supabase, siteId: "test", timeframe });

    expect(stats.locations).toEqual([
      { country: "US", city: "NYC", latitude: 40.7, longitude: -74.0, totalViews: 50, uniqueVisitors: 20 },
      { country: "DE", city: null, latitude: null, longitude: null, totalViews: 10, uniqueVisitors: 5 },
    ]);
  });

  it("returns empty arrays when no rows", async () => {
    const supabase = mockRpc({
      pulse_stats_by_timezone: { data: [], error: null },
      pulse_location_stats: { data: [], error: null },
    });

    const stats = await getPulseStats({ supabase, siteId: "test", timeframe });
    expect(stats).toEqual({ daily: [], topPages: [], locations: [] });
  });

  it("throws on stats RPC error", async () => {
    const supabase = mockRpc({
      pulse_stats_by_timezone: { data: null, error: { message: "fail" } },
      pulse_location_stats: { data: [], error: null },
    });

    await expect(
      getPulseStats({ supabase, siteId: "test", timeframe })
    ).rejects.toEqual({ message: "fail" });
  });

  it("throws on location RPC error", async () => {
    const supabase = mockRpc({
      pulse_stats_by_timezone: { data: [], error: null },
      pulse_location_stats: { data: null, error: { message: "loc fail" } },
    });

    await expect(
      getPulseStats({ supabase, siteId: "test", timeframe })
    ).rejects.toEqual({ message: "loc fail" });
  });
});

// ── getPulseVitals ─────────────────────────────────────────────────

describe("getPulseVitals", () => {
  it("rates vitals correctly using threshold logic", async () => {
    const supabase = mockRpc({
      pulse_vitals_stats: {
        data: [
          { metric: "lcp", p75: 2000, sample_count: 100, path: "__overall__" },
          { metric: "inp", p75: 300, sample_count: 80, path: "__overall__" },
          { metric: "cls", p75: 0.3, sample_count: 60, path: "__overall__" },
          { metric: "unknown_metric", p75: 999, sample_count: 10, path: "__overall__" },
        ],
        error: null,
      },
    });

    const vitals = await getPulseVitals({ supabase, siteId: "test", timeframe });

    expect(vitals.overall).toEqual([
      { metric: "lcp", p75: 2000, sampleCount: 100, rating: "good" },
      { metric: "inp", p75: 300, sampleCount: 80, rating: "needs-improvement" },
      { metric: "cls", p75: 0.3, sampleCount: 60, rating: "poor" },
      { metric: "unknown_metric", p75: 999, sampleCount: 10, rating: "good" },
    ]);
  });

  it("separates overall from per-page stats", async () => {
    const supabase = mockRpc({
      pulse_vitals_stats: {
        data: [
          { metric: "lcp", p75: 2500, sample_count: 50, path: "__overall__" },
          { metric: "lcp", p75: 3000, sample_count: 30, path: "/" },
          { metric: "fcp", p75: 1500, sample_count: 20, path: "/" },
        ],
        error: null,
      },
    });

    const vitals = await getPulseVitals({ supabase, siteId: "test", timeframe });

    expect(vitals.overall).toHaveLength(1);
    expect(vitals.overall[0].metric).toBe("lcp");

    expect(vitals.byPage).toHaveLength(1);
    expect(vitals.byPage[0].path).toBe("/");
    expect(vitals.byPage[0].vitals.lcp.p75).toBe(3000);
    expect(vitals.byPage[0].vitals.fcp.p75).toBe(1500);
  });

  it("sorts pages by LCP sample count desc and limits to 10", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      metric: "lcp",
      p75: 2500,
      sample_count: 120 - i * 10,
      path: `/page-${i}`,
    }));

    const supabase = mockRpc({
      pulse_vitals_stats: { data: rows, error: null },
    });

    const vitals = await getPulseVitals({ supabase, siteId: "test", timeframe });

    expect(vitals.byPage).toHaveLength(10);
    expect(vitals.byPage[0].path).toBe("/page-0");
    expect(vitals.byPage[9].path).toBe("/page-9");
  });
});

// ── getPulseErrors ─────────────────────────────────────────────────

describe("getPulseErrors", () => {
  it("maps fields and applies null fallbacks", async () => {
    const supabase = mockRpc({
      pulse_error_stats: {
        data: [
          {
            error_type: "error",
            message: null,
            path: null,
            total_count: "5",
            session_count: "3",
            last_seen: "2025-01-07",
            first_seen: "2025-01-01",
            sample_meta: null,
          },
        ],
        error: null,
      },
    });

    const result = await getPulseErrors({ supabase, siteId: "test", timeframe });

    expect(result.errors[0]).toEqual({
      errorType: "error",
      message: "",
      path: "",
      totalCount: 5,
      sessionCount: 3,
      lastSeen: "2025-01-07",
      firstSeen: "2025-01-01",
      sampleMeta: {},
    });
  });

  it("categorizes frontend vs server errors and totals correctly", async () => {
    const supabase = mockRpc({
      pulse_error_stats: {
        data: [
          { error_type: "error", message: "e1", path: "/", total_count: 10, session_count: 5, last_seen: "2025-01-07", first_seen: "2025-01-01", sample_meta: {} },
          { error_type: "error", message: "e2", path: "/x", total_count: 3, session_count: 2, last_seen: "2025-01-06", first_seen: "2025-01-02", sample_meta: {} },
          { error_type: "server_error", message: "s1", path: "/api", total_count: 7, session_count: 4, last_seen: "2025-01-07", first_seen: "2025-01-03", sample_meta: {} },
        ],
        error: null,
      },
    });

    const result = await getPulseErrors({ supabase, siteId: "test", timeframe });

    expect(result.totalFrontendErrors).toBe(13);
    expect(result.totalServerErrors).toBe(7);
    expect(result.totalErrorCount).toBe(20);
    expect(result.errors).toHaveLength(3);
  });
});
