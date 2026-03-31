import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

// ── Mocks ────────────────────────────────────────────────────────────

const mockGetPulseStats = vi.fn();
const mockGetPulseVitals = vi.fn();
const mockGetPulseErrors = vi.fn();
const mockGetPulseReferrers = vi.fn();
const mockGetPulseEvents = vi.fn();
const mockGetPulseSystemStats = vi.fn();

vi.mock("@pulsekit/core", () => ({
  getPulseStats: (...args: unknown[]) => mockGetPulseStats(...args),
  getPulseVitals: (...args: unknown[]) => mockGetPulseVitals(...args),
  getPulseErrors: (...args: unknown[]) => mockGetPulseErrors(...args),
  getPulseReferrers: (...args: unknown[]) => mockGetPulseReferrers(...args),
  getPulseEvents: (...args: unknown[]) => mockGetPulseEvents(...args),
  getPulseSystemStats: (...args: unknown[]) => mockGetPulseSystemStats(...args),
  dateRangeFromTimeframe: () => ({ startDate: "2025-01-01", endDate: "2025-01-07" }),
}));

// Stub child components to avoid their imports breaking in test
vi.mock("../PulseChart", () => ({ PulseChart: () => null }));
vi.mock("../PulseMap", () => ({ PulseMap: () => null }));
vi.mock("../PulseVitals", () => ({ PulseVitals: () => null }));
vi.mock("../PulseErrors", () => ({ PulseErrors: () => null }));
vi.mock("../PulseReferrers", () => ({ PulseReferrers: () => null }));
vi.mock("../PulseEvents", () => ({
  PulseEvents: () => React.createElement("div", { "data-testid": "events" }),
}));
vi.mock("../PulseSystem", () => ({
  PulseSystem: ({ siteId }: { siteId: string }) =>
    React.createElement("div", { "data-testid": "system", "data-site-id": siteId }),
}));
vi.mock("../RefreshButton", () => ({ RefreshButton: () => null }));
vi.mock("../PulseIcon", () => ({ PulseIcon: () => null }));
vi.mock("../PulseDateRangePicker", () => ({ PulseDateRangePicker: () => null }));
vi.mock("../PulseTabs", () => ({
  PulseTabs: ({ tabs, defaultTab }: { tabs: Array<{ id: string; label: string; content: React.ReactNode }>; defaultTab?: string }) =>
    React.createElement("div", { "data-testid": "tabs", "data-default-tab": defaultTab },
      tabs.map((tab) =>
        React.createElement("div", { key: tab.id, "data-tab-id": tab.id, "data-tab-label": tab.label }, tab.content)
      )
    ),
}));
vi.mock("../PulseTimeToggle", () => ({
  PulseTimeToggle: ({ value }: { value: string }) =>
    React.createElement("div", { "data-testid": "time-toggle", "data-value": value }),
}));

// Keep Card and KpiRow real enough to inspect props
vi.mock("../Card", () => ({
  Card: ({ title, children }: { title: string; children: React.ReactNode }) =>
    React.createElement("section", { "data-title": title }, children),
}));
vi.mock("../KpiRow", () => ({
  KpiRow: (props: { totalViews: number; uniqueVisitors: number; avgPerDay: number }) =>
    React.createElement("div", {
      "data-testid": "kpi",
      "data-views": props.totalViews,
      "data-unique": props.uniqueVisitors,
      "data-avg": props.avgPerDay,
    }),
}));

import { PulseDashboard } from "../PulseDashboard";

// ── Helpers ──────────────────────────────────────────────────────────

const mockSupabase = {} as any;

function emptyResults() {
  mockGetPulseStats.mockResolvedValue({ daily: [], topPages: [], locations: [] });
  mockGetPulseVitals.mockResolvedValue({ overall: [], byPage: [] });
  mockGetPulseErrors.mockResolvedValue({
    errors: [], totalErrorCount: 0, totalFrontendErrors: 0, totalServerErrors: 0,
  });
  mockGetPulseReferrers.mockResolvedValue({ referrers: [], totalSources: 0 });
  mockGetPulseEvents.mockResolvedValue({ events: [], totalCount: 0 });
  mockGetPulseSystemStats.mockResolvedValue({ stats: [] });
}

function populatedResults() {
  mockGetPulseStats.mockResolvedValue({
    daily: [
      { date: "2025-01-01", totalViews: 100, uniqueVisitors: 50 },
      { date: "2025-01-02", totalViews: 200, uniqueVisitors: 80 },
    ],
    topPages: [
      { path: "/", totalViews: 200, uniqueVisitors: 90 },
      { path: "/about", totalViews: 100, uniqueVisitors: 40 },
    ],
    locations: [
      { country: "US", city: "SF", latitude: 37.7, longitude: -122.4, totalViews: 150, uniqueVisitors: 70 },
    ],
  });
  mockGetPulseVitals.mockResolvedValue({
    overall: [{ metric: "lcp", p75: 2500, sampleCount: 10, rating: "good" }],
    byPage: [],
  });
  mockGetPulseErrors.mockResolvedValue({
    errors: [{ errorType: "error", message: "Test", path: "/", totalCount: 5, sessionCount: 3, lastSeen: "", firstSeen: "", sampleMeta: {} }],
    totalErrorCount: 5,
    totalFrontendErrors: 5,
    totalServerErrors: 0,
  });
  mockGetPulseReferrers.mockResolvedValue({
    referrers: [
      { referrer: "(direct)", totalViews: 150, uniqueVisitors: 70 },
      { referrer: "google.com", totalViews: 100, uniqueVisitors: 50 },
    ],
    totalSources: 2,
  });
  mockGetPulseEvents.mockResolvedValue({
    events: [
      { id: 1, eventType: "pageview", path: "/", sessionId: "abc123", referrer: null, country: "US", city: "SF", meta: null, createdAt: "2025-01-02T12:00:00Z" },
    ],
    totalCount: 1,
  });
  mockGetPulseSystemStats.mockResolvedValue({
    stats: [
      { key: "total_events", value: "500" },
      { key: "pageview_count", value: "300" },
      { key: "aggregates_rows", value: "45" },
    ],
  });
}

// Walk the JSX tree and collect info about rendered elements
// Shallow-expand a JSX tree: when a node's type is a function (mock component),
// call it with its props to produce the rendered output, then continue walking.
function expand(n: unknown): unknown {
  if (n == null || typeof n !== "object") return n;
  if (Array.isArray(n)) return n.map(expand);
  const el = n as React.ReactElement;
  if (!el.type && !el.props) return n;

  // If type is a function (mock or real component), call it to get rendered output
  if (typeof el.type === "function") {
    try {
      const rendered = (el.type as (...args: unknown[]) => unknown)(el.props);
      return expand(rendered);
    } catch {
      return n;
    }
  }

  // For intrinsic elements, expand children
  if (el.props?.children != null) {
    const children = el.props.children;
    const expanded = Array.isArray(children) ? children.map(expand) : expand(children);
    return { ...el, props: { ...el.props, children: expanded } };
  }
  return n;
}

function collectTree(node: unknown): string[] {
  const tags: string[] = [];
  const expanded = expand(node);

  function walk(n: unknown) {
    if (n == null || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    const el = n as React.ReactElement;
    if (!el.props && !el.type) return;
    if (el.props?.["data-title"]) tags.push(`card:${el.props["data-title"]}`);
    if (el.props?.["data-testid"]) tags.push(el.props["data-testid"]);
    if (el.props?.["data-tab-id"]) tags.push(`tab:${el.props["data-tab-id"]}`);
    if (el.props?.children != null) {
      const children = el.props.children;
      if (Array.isArray(children)) { children.forEach(walk); } else { walk(children); }
    }
  }

  walk(expanded);
  return tags;
}

function findByTestId(node: unknown, testId: string): React.ReactElement | null {
  const expanded = expand(node);

  function search(n: unknown): React.ReactElement | null {
    if (n == null || typeof n !== "object") return null;
    if (Array.isArray(n)) {
      for (const item of n) {
        const found = search(item);
        if (found) return found;
      }
      return null;
    }
    const el = n as React.ReactElement;
    if (el.props?.["data-testid"] === testId) return el;
    if (el.props?.children != null) {
      const children = el.props.children;
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = search(child);
          if (found) return found;
        }
      } else {
        return search(children);
      }
    }
    return null;
  }

  return search(expanded);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("PulseDashboard", () => {
  it("renders all five tabs", async () => {
    emptyResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    const tags = collectTree(result);

    expect(tags).toContain("tabs");
    expect(tags).toContain("tab:traffic");
    expect(tags).toContain("tab:vitals");
    expect(tags).toContain("tab:errors");
    expect(tags).toContain("tab:events");
    expect(tags).toContain("tab:system");
  });

  it("renders traffic card even when no data", async () => {
    emptyResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    const tags = collectTree(result);

    expect(tags).toContain("card:Traffic over time");
    // Should not show KPI or map when empty
    expect(tags).not.toContain("kpi");
    expect(tags).not.toContain("card:Visitors by location");
  });

  it("renders all traffic sections when data is populated", async () => {
    populatedResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    const tags = collectTree(result);

    expect(tags).toContain("kpi");
    expect(tags).toContain("card:Traffic over time");
    expect(tags).toContain("card:Top pages");
    expect(tags).toContain("card:Traffic sources");
    expect(tags).toContain("card:Visitors by location");
  });

  it("renders the events component in the events tab", async () => {
    populatedResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    const tags = collectTree(result);

    expect(tags).toContain("events");
  });

  it("computes KPI totals correctly", async () => {
    populatedResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });

    const kpi = findByTestId(result, "kpi");
    expect(kpi).not.toBeNull();
    expect(kpi!.props["data-views"]).toBe(300);     // 100 + 200
    expect(kpi!.props["data-unique"]).toBe(130);     // 50 + 80
    expect(kpi!.props["data-avg"]).toBe(150);        // 300 / 2
  });

  it("calls data functions with correct args", async () => {
    emptyResults();
    await PulseDashboard({ supabase: mockSupabase, siteId: "my-site", timeframe: "30d", range: "7d", timezone: "US/Pacific" });

    // Traffic uses the timeframe prop (date picker)
    expect(mockGetPulseStats).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site", timeframe: "30d", timezone: "US/Pacific" }),
    );
    // Referrers also use the traffic timeframe
    expect(mockGetPulseReferrers).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site", timeframe: "30d", timezone: "US/Pacific" }),
    );
    // Vitals, Errors, and Events use the range prop (time toggle)
    expect(mockGetPulseVitals).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site", timeframe: "7d", timezone: "US/Pacific" }),
    );
    expect(mockGetPulseErrors).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site", timeframe: "7d", timezone: "US/Pacific" }),
    );
    expect(mockGetPulseEvents).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site", timeframe: "7d", timezone: "US/Pacific" }),
    );
  });

  it("passes event filter props to getPulseEvents", async () => {
    emptyResults();
    await PulseDashboard({
      supabase: mockSupabase,
      siteId: "test",
      eventType: "pageview",
      eventPath: "/about",
      eventSession: "abc123",
      eventPage: 2,
    });

    expect(mockGetPulseEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "pageview",
        path: "/about",
        sessionId: "abc123",
        offset: 100,   // page 2 * 50
      }),
    );
  });

  it("passes range to vitals/errors/events as their timeframe", async () => {
    emptyResults();
    await PulseDashboard({ supabase: mockSupabase, siteId: "test", timeframe: { from: "2025-01-01", to: "2025-06-01" }, range: "30d" });

    // Vitals/errors/events should get "30d", not the custom date range
    expect(mockGetPulseVitals).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "30d" }),
    );
    expect(mockGetPulseErrors).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "30d" }),
    );
    expect(mockGetPulseEvents).toHaveBeenCalledWith(
      expect.objectContaining({ timeframe: "30d" }),
    );
  });

  it("gracefully handles individual data fetch failures", async () => {
    mockGetPulseStats.mockRejectedValue(new Error("DB error"));
    mockGetPulseVitals.mockRejectedValue(new Error("DB error"));
    mockGetPulseErrors.mockRejectedValue(new Error("DB error"));
    mockGetPulseReferrers.mockRejectedValue(new Error("DB error"));
    mockGetPulseEvents.mockRejectedValue(new Error("DB error"));
    mockGetPulseSystemStats.mockRejectedValue(new Error("DB error"));

    // Should not throw — each fetch has a .catch fallback
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    expect(result).toBeDefined();
  });

  it("calls onError for each failed data query", async () => {
    const onError = vi.fn();
    mockGetPulseStats.mockRejectedValue(new Error("stats fail"));
    mockGetPulseVitals.mockRejectedValue(new Error("vitals fail"));
    mockGetPulseErrors.mockRejectedValue(new Error("errors fail"));
    mockGetPulseReferrers.mockRejectedValue(new Error("referrers fail"));
    mockGetPulseEvents.mockRejectedValue(new Error("events fail"));
    mockGetPulseSystemStats.mockRejectedValue(new Error("system fail"));

    await PulseDashboard({ supabase: mockSupabase, siteId: "test", onError });

    expect(onError).toHaveBeenCalledTimes(6);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "stats fail" }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "vitals fail" }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "errors fail" }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "referrers fail" }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "events fail" }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "system fail" }));
  });

  it("renders the system component in the system tab", async () => {
    populatedResults();
    const result = await PulseDashboard({ supabase: mockSupabase, siteId: "test" });
    const tags = collectTree(result);

    expect(tags).toContain("system");
  });

  it("calls getPulseSystemStats with correct args", async () => {
    emptyResults();
    await PulseDashboard({ supabase: mockSupabase, siteId: "my-site" });

    expect(mockGetPulseSystemStats).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "my-site" }),
    );
  });
});
