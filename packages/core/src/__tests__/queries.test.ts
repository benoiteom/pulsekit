import { describe, it, expect } from "vitest";
import { getPulseStats, getPulseVitals, getPulseErrors, getPulseReferrers, getPulseEvents, getPulseSystemStats } from "../queries";

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

// ── getPulseReferrers ─────────────────────────────────────────────

describe("getPulseReferrers", () => {
  it("maps fields from snake_case to camelCase", async () => {
    const supabase = mockRpc({
      pulse_referrer_stats: {
        data: [
          { referrer: "(direct)", total_views: "312", unique_visitors: "200" },
          { referrer: "linkedin.com", total_views: "187", unique_visitors: "120" },
        ],
        error: null,
      },
    });

    const result = await getPulseReferrers({ supabase, siteId: "test", timeframe });

    expect(result.referrers).toEqual([
      { referrer: "(direct)", totalViews: 312, uniqueVisitors: 200 },
      { referrer: "linkedin.com", totalViews: 187, uniqueVisitors: 120 },
    ]);
    expect(result.totalSources).toBe(2);
  });

  it("returns empty referrers when no data", async () => {
    const supabase = mockRpc({
      pulse_referrer_stats: { data: [], error: null },
    });

    const result = await getPulseReferrers({ supabase, siteId: "test", timeframe });

    expect(result).toEqual({ referrers: [], totalSources: 0 });
  });

  it("handles null data gracefully", async () => {
    const supabase = mockRpc({
      pulse_referrer_stats: { data: null, error: null },
    });

    const result = await getPulseReferrers({ supabase, siteId: "test", timeframe });

    expect(result).toEqual({ referrers: [], totalSources: 0 });
  });

  it("throws on RPC error", async () => {
    const supabase = mockRpc({
      pulse_referrer_stats: { data: null, error: { message: "referrer fail" } },
    });

    await expect(
      getPulseReferrers({ supabase, siteId: "test", timeframe })
    ).rejects.toEqual({ message: "referrer fail" });
  });
});

// ── getPulseEvents ──────────────────────────────────────────────────

describe("getPulseEvents", () => {
  it("maps fields from snake_case to camelCase", async () => {
    const supabase = mockRpc({
      pulse_events_list: {
        data: [
          { id: 1, event_type: "pageview", path: "/", session_id: "abc", referrer: "google.com", country: "US", city: "NYC", meta: null, created_at: "2025-01-02T12:00:00Z" },
          { id: 2, event_type: "error", path: "/about", session_id: "def", referrer: null, country: null, city: null, meta: { stack: "err" }, created_at: "2025-01-01T08:00:00Z" },
        ],
        error: null,
      },
      pulse_events_count: { data: 42, error: null },
    });

    const result = await getPulseEvents({ supabase, siteId: "test", timeframe });

    expect(result.events).toEqual([
      { id: 1, eventType: "pageview", path: "/", sessionId: "abc", referrer: "google.com", country: "US", city: "NYC", meta: null, createdAt: "2025-01-02T12:00:00Z" },
      { id: 2, eventType: "error", path: "/about", sessionId: "def", referrer: null, country: null, city: null, meta: { stack: "err" }, createdAt: "2025-01-01T08:00:00Z" },
    ]);
    expect(result.totalCount).toBe(42);
  });

  it("returns empty events when no data", async () => {
    const supabase = mockRpc({
      pulse_events_list: { data: [], error: null },
      pulse_events_count: { data: 0, error: null },
    });

    const result = await getPulseEvents({ supabase, siteId: "test", timeframe });

    expect(result).toEqual({ events: [], totalCount: 0 });
  });

  it("handles null data gracefully", async () => {
    const supabase = mockRpc({
      pulse_events_list: { data: null, error: null },
      pulse_events_count: { data: null, error: null },
    });

    const result = await getPulseEvents({ supabase, siteId: "test", timeframe });

    expect(result).toEqual({ events: [], totalCount: 0 });
  });

  it("passes filter params to RPC", async () => {
    const rpcCalls: Record<string, unknown> = {};
    const supabase = {
      schema: () => ({
        rpc: (name: string, params: unknown) => {
          rpcCalls[name] = params;
          return { data: name === "pulse_events_count" ? 0 : [], error: null };
        },
      }),
    } as any;

    await getPulseEvents({
      supabase,
      siteId: "my-site",
      timeframe,
      eventType: "error",
      path: "/about",
      sessionId: "sess-123",
      limit: 25,
      offset: 50,
    });

    expect(rpcCalls.pulse_events_list).toMatchObject({
      p_site_id: "my-site",
      p_event_type: "error",
      p_path: "/about",
      p_session_id: "sess-123",
      p_limit: 25,
      p_offset: 50,
    });
    expect(rpcCalls.pulse_events_count).toMatchObject({
      p_site_id: "my-site",
      p_event_type: "error",
      p_path: "/about",
      p_session_id: "sess-123",
    });
  });

  it("sends null for empty filter strings", async () => {
    const rpcCalls: Record<string, unknown> = {};
    const supabase = {
      schema: () => ({
        rpc: (name: string, params: unknown) => {
          rpcCalls[name] = params;
          return { data: name === "pulse_events_count" ? 0 : [], error: null };
        },
      }),
    } as any;

    await getPulseEvents({ supabase, siteId: "test", timeframe, eventType: "", path: "", sessionId: "" });

    expect(rpcCalls.pulse_events_list).toMatchObject({
      p_event_type: null,
      p_path: null,
      p_session_id: null,
    });
  });

  it("throws on list RPC error", async () => {
    const supabase = mockRpc({
      pulse_events_list: { data: null, error: { message: "list fail" } },
      pulse_events_count: { data: 0, error: null },
    });

    await expect(
      getPulseEvents({ supabase, siteId: "test", timeframe })
    ).rejects.toEqual({ message: "list fail" });
  });

  it("throws on count RPC error", async () => {
    const supabase = mockRpc({
      pulse_events_list: { data: [], error: null },
      pulse_events_count: { data: null, error: { message: "count fail" } },
    });

    await expect(
      getPulseEvents({ supabase, siteId: "test", timeframe })
    ).rejects.toEqual({ message: "count fail" });
  });
});

// ── getPulseSystemStats ────────────────────────────────────────────

describe("getPulseSystemStats", () => {
  it("maps stat_key/stat_value to key/value", async () => {
    const supabase = mockRpc({
      pulse_system_stats: {
        data: [
          { stat_key: "total_events", stat_value: "500" },
          { stat_key: "pageview_count", stat_value: "300" },
        ],
        error: null,
      },
    });

    const result = await getPulseSystemStats({ supabase, siteId: "test" });

    expect(result.stats).toEqual([
      { key: "total_events", value: "500" },
      { key: "pageview_count", value: "300" },
    ]);
  });

  it("returns empty stats when no data", async () => {
    const supabase = mockRpc({
      pulse_system_stats: { data: [], error: null },
    });

    const result = await getPulseSystemStats({ supabase, siteId: "test" });
    expect(result).toEqual({ stats: [] });
  });

  it("handles null data gracefully", async () => {
    const supabase = mockRpc({
      pulse_system_stats: { data: null, error: null },
    });

    const result = await getPulseSystemStats({ supabase, siteId: "test" });
    expect(result).toEqual({ stats: [] });
  });

  it("coerces null stat_value to empty string", async () => {
    const supabase = mockRpc({
      pulse_system_stats: {
        data: [{ stat_key: "oldest_event", stat_value: null }],
        error: null,
      },
    });

    const result = await getPulseSystemStats({ supabase, siteId: "test" });
    expect(result.stats[0].value).toBe("");
  });

  it("throws on RPC error", async () => {
    const supabase = mockRpc({
      pulse_system_stats: { data: null, error: { message: "system fail" } },
    });

    await expect(
      getPulseSystemStats({ supabase, siteId: "test" })
    ).rejects.toEqual({ message: "system fail" });
  });
});
