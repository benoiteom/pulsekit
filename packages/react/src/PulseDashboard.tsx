import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPulseStats, getPulseVitals, getPulseErrors, getPulseAggregates, dateRangeFromTimeframe, type Timeframe } from "@pulsekit/core";
import { Card } from "./Card";
import { PulseChart } from "./PulseChart";
import { PulseMap } from "./PulseMap";
import { PulseVitals } from "./PulseVitals";
import { PulseErrors } from "./PulseErrors";
import { PulseAggregates } from "./PulseAggregates";
import { RefreshButton } from "./RefreshButton";
import { PulseIcon } from "./PulseIcon";
import { PulseDateRangePicker } from "./PulseDateRangePicker";
import { KpiRow } from "./KpiRow";

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
  const [stats, vitals, errors, aggregates] = await Promise.all([
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
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <PulseIcon size={24} />
          <h1 className="text-2xl font-semibold m-0" style={{ color: "var(--pulse-fg)" }}>
            pulsekit
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <PulseDateRangePicker from={startDate} to={endDate} />
          <RefreshButton endpoint={refreshEndpoint} />
        </div>
      </div>

      {stats.daily.length > 0 && (
        <div className="mb-6">
          <KpiRow totalViews={totalViews} uniqueVisitors={uniqueVisitors} avgPerDay={avgPerDay} />
        </div>
      )}

      <div className="flex flex-col gap-6">
        <Card title="Traffic over time">
          {stats.daily.length === 0 ? (
            <p className="text-sm m-0" style={{ color: "var(--pulse-fg-muted)" }}>
              No analytics data yet. Visit your site and refresh aggregates.
            </p>
          ) : (
            <PulseChart data={stats.daily} />
          )}
        </Card>

        <div className={hasVitals ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
          <Card title="Top pages">
            {stats.topPages.length === 0 ? (
              <p className="text-sm m-0" style={{ color: "var(--pulse-fg-muted)" }}>
                No page data available for this timeframe.
              </p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th
                      className="text-left py-2 text-sm font-medium"
                      style={{ borderBottom: "1px solid var(--pulse-border)" }}
                    >
                      Path
                    </th>
                    <th
                      className="text-right py-2 text-sm font-medium"
                      style={{ borderBottom: "1px solid var(--pulse-border)" }}
                    >
                      Views
                    </th>
                    <th
                      className="text-right py-2 text-sm font-medium"
                      style={{ borderBottom: "1px solid var(--pulse-border)" }}
                    >
                      Unique
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPages.map((p) => (
                    <tr key={p.path} className="pulse-table-row">
                      <td
                        className="py-2 text-xs font-mono"
                        style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                      >
                        {p.path}
                      </td>
                      <td
                        className="text-right py-2 text-sm"
                        style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                      >
                        {p.totalViews}
                      </td>
                      <td
                        className="text-right py-2 text-sm"
                        style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                      >
                        {p.uniqueVisitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {hasVitals && (
            <Card title="Web Vitals">
              <PulseVitals data={vitals} />
            </Card>
          )}
        </div>

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
