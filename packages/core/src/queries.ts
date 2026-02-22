import type { SupabaseClient } from "@supabase/supabase-js";

export type Timeframe = "7d" | "30d" | { from: string; to: string };

// ── Web Vitals types ────────────────────────────────────────────────

export type WebVitalRating = "good" | "needs-improvement" | "poor";

export interface WebVitalStat {
  metric: string;
  p75: number;
  sampleCount: number;
  rating: WebVitalRating;
}

export interface PageVitalsStat {
  path: string;
  vitals: Record<string, WebVitalStat>;
}

export interface VitalsOverview {
  overall: WebVitalStat[];
  byPage: PageVitalsStat[];
}

const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  lcp: [2500, 4000],
  inp: [200, 500],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
};

function rateVital(metric: string, p75: number): WebVitalRating {
  const thresholds = VITAL_THRESHOLDS[metric];
  if (!thresholds) return "good";
  if (p75 <= thresholds[0]) return "good";
  if (p75 <= thresholds[1]) return "needs-improvement";
  return "poor";
}

export interface DailyStat {
  date: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface TopPageStat {
  path: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface LocationStat {
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  totalViews: number;
  uniqueVisitors: number;
}

export interface PulseStats {
  daily: DailyStat[];
  topPages: TopPageStat[];
  locations: LocationStat[];
}

/**
 * Convert a {@link Timeframe} into a concrete `{ startDate, endDate }` pair
 * (ISO date strings, e.g. `"2025-01-15"`), anchored to the given IANA timezone.
 */
export function dateRangeFromTimeframe(
  timeframe: Timeframe,
  timezone: string
): { startDate: string; endDate: string } {
  if (typeof timeframe === "object") {
    return { startDate: timeframe.from, endDate: timeframe.to };
  }
  const days = timeframe === "7d" ? 7 : 30;
  const now = new Date();
  const localNow = new Date(
    now.toLocaleString("en-US", { timeZone: timezone })
  );
  const endDate = localNow.toISOString().slice(0, 10);
  localNow.setDate(localNow.getDate() - (days - 1));
  const startDate = localNow.toISOString().slice(0, 10);
  return { startDate, endDate };
}

/**
 * Fetch pageview statistics (daily totals, top pages, and locations) for a site
 * within the given timeframe. Calls the `pulse_stats_by_timezone` and
 * `pulse_location_stats` Supabase RPCs in parallel.
 */
export async function getPulseStats(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<PulseStats> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, timezone);

  const [statsResult, locationResult] = await Promise.all([
    supabase.schema("analytics").rpc("pulse_stats_by_timezone", {
      p_site_id: siteId,
      p_timezone: timezone,
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    supabase.schema("analytics").rpc("pulse_location_stats", {
      p_site_id: siteId,
      p_start_date: startDate,
      p_end_date: endDate,
    }),
  ]);

  if (statsResult.error) throw statsResult.error;
  if (locationResult.error) throw locationResult.error;

  const rows = statsResult.data;
  const locationRows = locationResult.data;

  const locations: LocationStat[] = (locationRows ?? []).map(
    (row: { country: string; city: string | null; latitude: number | null; longitude: number | null; total_views: number; unique_visitors: number }) => ({
      country: row.country,
      city: row.city ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      totalViews: Number(row.total_views),
      uniqueVisitors: Number(row.unique_visitors),
    })
  );

  if (!rows || rows.length === 0) {
    return { daily: [], topPages: [], locations };
  }

  // Group by date for daily stats
  const byDate = new Map<string, { views: number; unique: number }>();
  for (const row of rows) {
    const d = String(row.date);
    const existing = byDate.get(d);
    if (existing) {
      existing.views += Number(row.total_views);
      existing.unique += Number(row.unique_visitors);
    } else {
      byDate.set(d, {
        views: Number(row.total_views),
        unique: Number(row.unique_visitors),
      });
    }
  }

  const daily: DailyStat[] = Array.from(byDate.entries()).map(
    ([date, { views, unique }]) => ({
      date,
      totalViews: views,
      uniqueVisitors: unique,
    })
  );

  // Group by path for top pages
  const byPath = new Map<string, { views: number; unique: number }>();
  for (const row of rows) {
    const p = row.path;
    const existing = byPath.get(p);
    if (existing) {
      existing.views += Number(row.total_views);
      existing.unique += Number(row.unique_visitors);
    } else {
      byPath.set(p, {
        views: Number(row.total_views),
        unique: Number(row.unique_visitors),
      });
    }
  }

  const topPages: TopPageStat[] = Array.from(byPath.entries())
    .map(([path, { views, unique }]) => ({
      path,
      totalViews: views,
      uniqueVisitors: unique,
    }))
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10);

  return { daily, topPages, locations };
}

// ── Referrer types ──────────────────────────────────────────────────

export interface ReferrerStat {
  referrer: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface ReferrersOverview {
  referrers: ReferrerStat[];
  totalSources: number;
}

// ── Referrer query ──────────────────────────────────────────────────

/**
 * Fetch top traffic sources (referrer hostnames) for a site within the
 * given timeframe. Calls the `pulse_referrer_stats` Supabase RPC.
 */
export async function getPulseReferrers(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<ReferrersOverview> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, timezone);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .rpc("pulse_referrer_stats", {
      p_site_id: siteId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

  if (error) throw error;

  const referrers: ReferrerStat[] = (rows ?? []).map(
    (row: { referrer: string; total_views: number; unique_visitors: number }) => ({
      referrer: row.referrer,
      totalViews: Number(row.total_views),
      uniqueVisitors: Number(row.unique_visitors),
    })
  );

  return { referrers, totalSources: referrers.length };
}

// ── Error types ─────────────────────────────────────────────────────

export interface ErrorStat {
  errorType: string;
  message: string;
  path: string;
  totalCount: number;
  sessionCount: number;
  lastSeen: string;
  firstSeen: string;
  sampleMeta: Record<string, unknown>;
}

export interface ErrorsOverview {
  errors: ErrorStat[];
  totalErrorCount: number;
  totalFrontendErrors: number;
  totalServerErrors: number;
}

// ── Aggregates types ────────────────────────────────────────────────

export interface AggregateRow {
  date: string;
  path: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface AggregatesOverview {
  rows: AggregateRow[];
  totalRows: number;
  totalViews: number;
}

// ── Aggregates query ────────────────────────────────────────────────

/**
 * Fetch pre-aggregated daily analytics rows for a site within the given
 * timeframe. Returns rows sorted by date (descending) then path.
 */
export async function getPulseAggregates(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<AggregatesOverview> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, timezone);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .from("pulse_aggregates")
    .select("date, path, total_views, unique_visitors")
    .eq("site_id", siteId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("path");

  if (error) throw error;

  const mapped: AggregateRow[] = (rows ?? []).map(
    (row: { date: string; path: string; total_views: number; unique_visitors: number }) => ({
      date: row.date,
      path: row.path,
      totalViews: Number(row.total_views),
      uniqueVisitors: Number(row.unique_visitors),
    })
  );

  let totalViews = 0;
  for (const r of mapped) {
    totalViews += r.totalViews;
  }

  return { rows: mapped, totalRows: mapped.length, totalViews };
}

// ── Web Vitals query ────────────────────────────────────────────────

/**
 * Fetch Core Web Vitals statistics (LCP, INP, CLS, FCP, TTFB) for a site.
 * Returns an overall summary and per-page breakdowns, each rated as
 * "good", "needs-improvement", or "poor" based on standard thresholds.
 */
export async function getPulseVitals(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<VitalsOverview> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, timezone);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .rpc("pulse_vitals_stats", {
      p_site_id: siteId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

  if (error) throw error;

  const overall: WebVitalStat[] = [];
  const pageMap = new Map<string, Record<string, WebVitalStat>>();

  for (const row of rows ?? []) {
    const stat: WebVitalStat = {
      metric: row.metric,
      p75: Number(row.p75),
      sampleCount: Number(row.sample_count),
      rating: rateVital(row.metric, Number(row.p75)),
    };

    if (row.path === "__overall__") {
      overall.push(stat);
    } else {
      let entry = pageMap.get(row.path);
      if (!entry) {
        entry = {};
        pageMap.set(row.path, entry);
      }
      entry[row.metric] = stat;
    }
  }

  const byPage: PageVitalsStat[] = Array.from(pageMap.entries())
    .map(([path, vitals]) => ({ path, vitals }))
    .sort((a, b) => {
      const aLcp = a.vitals.lcp?.sampleCount ?? 0;
      const bLcp = b.vitals.lcp?.sampleCount ?? 0;
      return bLcp - aLcp;
    })
    .slice(0, 10);

  return { overall, byPage };
}

// ── Error stats query ───────────────────────────────────────────────

/**
 * Fetch error statistics for a site within the given timeframe.
 * Groups errors by type/message/path and returns counts, first/last seen
 * timestamps, and a breakdown of frontend vs server errors.
 */
export async function getPulseErrors(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<ErrorsOverview> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, timezone);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .rpc("pulse_error_stats", {
      p_site_id: siteId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

  if (error) throw error;

  const errors: ErrorStat[] = (rows ?? []).map(
    (row: {
      error_type: string;
      message: string;
      path: string;
      total_count: number;
      session_count: number;
      last_seen: string;
      first_seen: string;
      sample_meta: Record<string, unknown>;
    }) => ({
      errorType: row.error_type,
      message: row.message ?? "",
      path: row.path ?? "",
      totalCount: Number(row.total_count),
      sessionCount: Number(row.session_count),
      lastSeen: row.last_seen,
      firstSeen: row.first_seen,
      sampleMeta: row.sample_meta ?? {},
    })
  );

  let totalFrontendErrors = 0;
  let totalServerErrors = 0;
  for (const e of errors) {
    if (e.errorType === "error") {
      totalFrontendErrors += e.totalCount;
    } else {
      totalServerErrors += e.totalCount;
    }
  }

  return {
    errors,
    totalErrorCount: totalFrontendErrors + totalServerErrors,
    totalFrontendErrors,
    totalServerErrors,
  };
}
