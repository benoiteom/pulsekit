import type { SupabaseClient } from "@supabase/supabase-js";

export type Timeframe = "7d" | "30d";

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

function daysFromTimeframe(timeframe: Timeframe): number {
  return timeframe === "7d" ? 7 : 30;
}

function cutoffDate(timeframe: Timeframe, timezone: string): string {
  const days = daysFromTimeframe(timeframe);
  // Build cutoff in the viewer's perspective — the RPC already handles
  // timezone-aware bucketing, but we need to trim the extra buffer day
  // that the SQL fetches. We compute the cutoff as a plain YYYY-MM-DD
  // string in the viewer's timezone.
  const now = new Date();
  const localNow = new Date(
    now.toLocaleString("en-US", { timeZone: timezone })
  );
  localNow.setDate(localNow.getDate() - (days - 1));
  return localNow.toISOString().slice(0, 10);
}

export async function getPulseStats(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
  timezone?: string;
}): Promise<PulseStats> {
  const { supabase, siteId, timeframe, timezone = "UTC" } = opts;
  const days = daysFromTimeframe(timeframe);
  const since = cutoffDate(timeframe, timezone);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .rpc("pulse_stats_by_timezone", {
      p_site_id: siteId,
      p_timezone: timezone,
      p_days_back: days,
    });

  // Fetch location stats in parallel
  const { data: locationRows, error: locationError } = await supabase
    .schema("analytics")
    .rpc("pulse_location_stats", {
      p_site_id: siteId,
      p_days_back: days,
    });

  if (error) throw error;
  if (locationError) throw locationError;

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

  // Group by date for daily stats (filter out the buffer day)
  const byDate = new Map<string, { views: number; unique: number }>();
  for (const row of rows) {
    const d = String(row.date);
    if (d < since) continue; // trim buffer day
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

  // Group by path for top pages (also respecting the date filter)
  const byPath = new Map<string, { views: number; unique: number }>();
  for (const row of rows) {
    const d = String(row.date);
    if (d < since) continue;
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

// ── Web Vitals query ────────────────────────────────────────────────

export async function getPulseVitals(opts: {
  supabase: SupabaseClient;
  siteId: string;
  timeframe: Timeframe;
}): Promise<VitalsOverview> {
  const { supabase, siteId, timeframe } = opts;
  const days = daysFromTimeframe(timeframe);

  const { data: rows, error } = await supabase
    .schema("analytics")
    .rpc("pulse_vitals_stats", {
      p_site_id: siteId,
      p_days_back: days,
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
