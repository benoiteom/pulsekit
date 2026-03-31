import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPulseStats, getPulseVitals, getPulseErrors, getPulseReferrers, getPulseEvents, getPulseSystemStats, dateRangeFromTimeframe, type Timeframe } from "@pulsekit/core";
import { Card } from "./Card.js";
import { PulseChart } from "./PulseChart.js";
import { PulseMap } from "./PulseMap.js";
import { PulseVitals } from "./PulseVitals.js";
import { PulseErrors } from "./PulseErrors.js";
import { PulseReferrers } from "./PulseReferrers.js";
import { PulseEvents } from "./PulseEvents.js";
import { PulseSystem } from "./PulseSystem.js";
import { RefreshButton } from "./RefreshButton.js";
import { PulseIcon } from "./PulseIcon.js";
import { PulseDateRangePicker } from "./PulseDateRangePicker.js";
import { KpiRow } from "./KpiRow.js";
import { PulseTabs } from "./PulseTabs.js";
import { PulseTimeToggle } from "./PulseTimeToggle.js";

export interface PulseDashboardProps {
  supabase: SupabaseClient;
  siteId: string;
  /** Timeframe for the Traffic tab (date picker). Defaults to "7d". */
  timeframe?: Timeframe;
  /** Timeframe for Vitals/Errors/Events tabs (time toggle). Defaults to "7d". */
  range?: "7d" | "30d";
  /** Active tab. Defaults to "traffic". */
  tab?: string;
  timezone?: string;
  refreshEndpoint?: string;
  /** Called when a data query fails. By default failures are not logged. */
  onError?: (error: unknown) => void;
  /** Event browser: filter by event type. */
  eventType?: string;
  /** Event browser: filter by path. */
  eventPath?: string;
  /** Event browser: filter by session ID. */
  eventSession?: string;
  /** Event browser: page number (0-indexed). */
  eventPage?: number;
}

export async function PulseDashboard({
  supabase,
  siteId,
  timeframe = "7d",
  range = "7d",
  tab = "traffic",
  timezone,
  refreshEndpoint,
  onError,
  eventType,
  eventPath,
  eventSession,
  eventPage = 0,
}: PulseDashboardProps) {
  const tz = timezone ?? "UTC";

  // Vitals, Errors, and Events use the range toggle (7d/30d), not the date picker
  const recentTimeframe: Timeframe = range;

  const [stats, vitals, errors, referrers, events, systemStats] = await Promise.all([
    getPulseStats({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { daily: [], topPages: [], locations: [] };
    }),
    getPulseVitals({ supabase, siteId, timeframe: recentTimeframe, timezone }).catch((err) => {
      onError?.(err);
      return { overall: [], byPage: [] };
    }),
    getPulseErrors({ supabase, siteId, timeframe: recentTimeframe, timezone }).catch((err) => {
      onError?.(err);
      return { errors: [], totalErrorCount: 0, totalFrontendErrors: 0, totalServerErrors: 0 };
    }),
    getPulseReferrers({ supabase, siteId, timeframe, timezone }).catch((err) => {
      onError?.(err);
      return { referrers: [], totalSources: 0 };
    }),
    getPulseEvents({
      supabase,
      siteId,
      timeframe: recentTimeframe,
      timezone,
      eventType: eventType || undefined,
      path: eventPath || undefined,
      sessionId: eventSession || undefined,
      limit: 50,
      offset: eventPage * 50,
    }).catch((err) => {
      onError?.(err);
      return { events: [], totalCount: 0 };
    }),
    getPulseSystemStats({ supabase, siteId }).catch((err) => {
      onError?.(err);
      return { stats: [] };
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

  const { startDate, endDate } = dateRangeFromTimeframe(timeframe, tz);

  // ── Tab actions (rendered in toolbar) ─────────────────────────
  const trafficActions = (
    <>
      <PulseDateRangePicker from={startDate} to={endDate} />
      <RefreshButton endpoint={refreshEndpoint} />
    </>
  );
  const rangeActions = <PulseTimeToggle value={range} />;

  // ── Traffic tab ────────────────────────────────────────────────
  const trafficContent = (
    <div className="pulse-dashboard-sections">
      {stats.daily.length > 0 && (
        <KpiRow totalViews={totalViews} uniqueVisitors={uniqueVisitors} avgPerDay={avgPerDay} />
      )}

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

      {stats.locations.length > 0 && (
        <Card title="Visitors by location">
          <PulseMap data={stats.locations} />
        </Card>
      )}
    </div>
  );

  // ── Vitals tab ─────────────────────────────────────────────────
  const vitalsContent = (
    <div className="pulse-dashboard-sections">
      {vitals.overall.length > 0 ? (
        <PulseVitals data={vitals} />
      ) : (
        <p className="pulse-text-empty">
          No web vitals data available for this period.
        </p>
      )}
    </div>
  );

  // ── Errors tab ─────────────────────────────────────────────────
  const errorsContent = (
    <div className="pulse-dashboard-sections">
      {errors.totalErrorCount > 0 ? (
        <PulseErrors data={errors} />
      ) : (
        <p className="pulse-text-empty">
          No errors recorded in this period.
        </p>
      )}
    </div>
  );

  // ── Events tab ─────────────────────────────────────────────────
  const eventsContent = (
    <div className="pulse-dashboard-sections">
      <PulseEvents
        data={events}
        filters={{
          eventType: eventType || "",
          path: eventPath || "",
          sessionId: eventSession || "",
          page: eventPage,
        }}
      />
    </div>
  );

  // ── System tab ────────────────────────────────────────────────
  const systemContent = (
    <PulseSystem data={systemStats} siteId={siteId} />
  );

  return (
    <div className="pulse-dashboard">
      <PulseTabs
        defaultTab={tab}
        headerLeft={
          <div className="pulse-dashboard-logo">
            <PulseIcon size={24} />
            <h1 className="pulse-heading">pulsekit</h1>
          </div>
        }
        tabs={[
          { id: "traffic", label: "Traffic", content: trafficContent, actions: trafficActions },
          { id: "vitals", label: "Vitals", content: vitalsContent, actions: rangeActions },
          { id: "errors", label: "Errors", content: errorsContent, actions: rangeActions },
          { id: "events", label: "Events", content: eventsContent, actions: rangeActions },
          { id: "system", label: "System", content: systemContent },
        ]}
      />
    </div>
  );
}
