import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPulseStats, getPulseVitals, getPulseErrors, getPulseAggregates, getPulseReferrers, dateRangeFromTimeframe, type Timeframe } from "@pulsekit/core";
import { Card } from "./Card.js";
import { PulseChart } from "./PulseChart.js";
import { PulseMap } from "./PulseMap.js";
import { PulseVitals } from "./PulseVitals.js";
import { PulseErrors } from "./PulseErrors.js";
import { PulseAggregates } from "./PulseAggregates.js";
import { PulseReferrers } from "./PulseReferrers.js";
import { RefreshButton } from "./RefreshButton.js";
import { PulseIcon } from "./PulseIcon.js";
import { PulseDateRangePicker } from "./PulseDateRangePicker.js";
import { KpiRow } from "./KpiRow.js";

export interface PulseDashboardProps {
  supabase: SupabaseClient;
  siteId: string;
  timeframe?: Timeframe;
  timezone?: string;
  refreshEndpoint?: string;
  /** Called when a data query fails. By default failures are not logged. */
  onError?: (error: unknown) => void;
}

export async function PulseDashboard({
  supabase,
  siteId,
  timeframe = "7d",
  timezone,
  refreshEndpoint,
  onError,
}: PulseDashboardProps) {
  const [stats, vitals, errors, aggregates, referrers] = await Promise.all([
    getPulseStats({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { daily: [], topPages: [], locations: [] };
    }),
    getPulseVitals({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { overall: [], byPage: [] };
    }),
    getPulseErrors({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { errors: [], totalErrorCount: 0, totalFrontendErrors: 0, totalServerErrors: 0 };
    }),
    getPulseAggregates({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { rows: [], totalRows: 0, totalViews: 0 };
    }),
    getPulseReferrers({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { referrers: [], totalSources: 0 };
    }),
  ]);

  // Compute KPI totals from daily data
  let totalViews = 0;
  let uniqueVisitors = 0;
  for (const day of stats.daily) {
    totalViews += day.totalViews;
    uniqueVisitors += day.uniqueVisitors;
  }
  const avgPerDay = stats.daily.length > 0 ? Math.round(totalViews / stats.daily.length) : 0;

  const tz = timezone ?? "UTC";
  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, tz);

  const hasVitals = vitals.overall.length > 0;
  const hasLocations = stats.locations.length > 0;

  return (
    <div className="pulse-dashboard">
      <div className="pulse-dashboard-header">
        <div className="pulse-dashboard-logo">
          <PulseIcon size={24} />
          <h1 className="pulse-heading">pulsekit</h1>
        </div>
        <div className="pulse-dashboard-actions">
          <PulseDateRangePicker from={startDate} to={endDate} />
          <RefreshButton endpoint={refreshEndpoint} />
        </div>
      </div>

      {stats.daily.length > 0 && (
        <div className="pulse-dashboard-kpis">
          <KpiRow totalViews={totalViews} uniqueVisitors={uniqueVisitors} avgPerDay={avgPerDay} />
        </div>
      )}

      <div className="pulse-dashboard-sections">
        <Card title="Traffic over time">
          {stats.daily.length === 0 ? (
            <p className="pulse-text-empty">
              No analytics data yet. Visit your site and refresh aggregates.
            </p>
          ) : (
            <PulseChart data={stats.daily} />
          )}
        </Card>

        <div className="pulse-dashboard-grid">
          <Card title="Top pages">
            {stats.topPages.length === 0 ? (
              <p className="pulse-text-empty">
                No page data available for this timeframe.
              </p>
            ) : (
              <table className="pulse-table">
                <thead>
                  <tr>
                    <th className="pulse-th">Path</th>
                    <th className="pulse-th pulse-th--right">Views</th>
                    <th className="pulse-th pulse-th--right">Unique</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPages.map((p) => (
                    <tr key={p.path} className="pulse-table-row">
                      <td className="pulse-td pulse-td--mono">{p.path}</td>
                      <td className="pulse-td pulse-td--right">{p.totalViews}</td>
                      <td className="pulse-td pulse-td--right">{p.uniqueVisitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Traffic sources">
            <PulseReferrers data={referrers} />
          </Card>
        </div>

        {hasVitals && (
          <Card title="Web Vitals">
            <PulseVitals data={vitals} />
          </Card>
        )}

        {errors.totalErrorCount > 0 && (
          <Card title="Errors">
            <PulseErrors data={errors} />
          </Card>
        )}

        {hasLocations && (
          <Card title="Visitors by location">
            <PulseMap data={stats.locations} />
          </Card>
        )}

        {aggregates.totalRows > 0 && (
          <Card title="Consolidated data">
            <PulseAggregates data={aggregates} />
          </Card>
        )}
      </div>
    </div>
  );
}
