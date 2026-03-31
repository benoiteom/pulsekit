import React from "react";
import type { SystemOverview } from "@pulsekit/core";
import { Card } from "./Card.js";

export interface PulseSystemProps {
  data: SystemOverview;
  siteId: string;
}

function get(stats: SystemOverview["stats"], key: string): string {
  return stats.find((s) => s.key === key)?.value ?? "";
}

function formatNumber(n: number): string {
  if (Number.isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function Chip({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="pulse-chip" style={{ backgroundColor: "var(--pulse-kpi-bg)" }}>
      <div className="pulse-chip-label">{label}</div>
      <div className="pulse-chip-value" style={{ color: color ?? "var(--pulse-brand)" }}>
        {value}
      </div>
    </div>
  );
}

function SmallChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="pulse-system-small-chip">
      <span className="pulse-system-small-chip-label">{label}</span>
      <span className="pulse-system-small-chip-value">{value}</span>
    </span>
  );
}

function staleDays(newestDate: string): number {
  if (!newestDate) return -1;
  const d = new Date(newestDate);
  if (Number.isNaN(d.getTime())) return -1;
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86_400_000);
}

export function PulseSystem({ data, siteId }: PulseSystemProps) {
  const { stats } = data;

  const totalEvents = Number(get(stats, "total_events")) || 0;
  const pageviews = Number(get(stats, "pageview_count")) || 0;
  const vitals = Number(get(stats, "vitals_count")) || 0;
  const errors = Number(get(stats, "error_count")) || 0;
  const serverErrors = Number(get(stats, "server_error_count")) || 0;
  const custom = Number(get(stats, "custom_count")) || 0;

  const oldestEvent = get(stats, "oldest_event");
  const newestEvent = get(stats, "newest_event");

  const aggRows = Number(get(stats, "aggregates_rows")) || 0;
  const aggOldest = get(stats, "aggregates_oldest");
  const aggNewest = get(stats, "aggregates_newest");
  const refAggRows = Number(get(stats, "referrer_aggregates_rows")) || 0;
  const locAggRows = Number(get(stats, "location_aggregates_rows")) || 0;

  const distinctSessions = Number(get(stats, "distinct_sessions")) || 0;
  const distinctPaths = Number(get(stats, "distinct_paths")) || 0;

  // Compute events per day
  let eventsPerDay = 0;
  if (oldestEvent && newestEvent && totalEvents > 0) {
    const days = Math.max(1, Math.ceil(
      (new Date(newestEvent).getTime() - new Date(oldestEvent).getTime()) / 86_400_000
    ));
    eventsPerDay = Math.round(totalEvents / days);
  }

  const aggStale = staleDays(aggNewest);
  const isAggStale = aggStale > 1;

  return (
    <div className="pulse-dashboard-sections">
      <Card title="Pipeline Health">
        <div className="pulse-kpi-row">
          <Chip label="Raw Events" value={formatNumber(totalEvents)} />
          <Chip label="Events / Day" value={formatNumber(eventsPerDay)} />
          <Chip label="Retention Window" value={oldestEvent && newestEvent
            ? `${formatDate(oldestEvent)} — ${formatDate(newestEvent)}`
            : "—"
          } />
        </div>
        <div className="pulse-system-breakdown">
          <SmallChip label="Pageviews" value={formatNumber(pageviews)} />
          <SmallChip label="Vitals" value={formatNumber(vitals)} />
          <SmallChip label="Errors" value={formatNumber(errors)} />
          <SmallChip label="Server Errors" value={formatNumber(serverErrors)} />
          <SmallChip label="Custom" value={formatNumber(custom)} />
        </div>
      </Card>

      <Card title="Aggregation Status">
        <div className="pulse-kpi-row">
          <Chip label="Aggregate Rows" value={formatNumber(aggRows)} />
          <Chip label="Referrer Agg. Rows" value={formatNumber(refAggRows)} />
          <Chip label="Location Agg. Rows" value={formatNumber(locAggRows)} />
        </div>
        {aggRows > 0 && (
          <div className="pulse-system-agg-detail">
            <p className="pulse-system-agg-range">
              Coverage: {formatDate(aggOldest)} — {formatDate(aggNewest)}
            </p>
            {isAggStale && (
              <p className="pulse-system-agg-warn">
                Aggregates are {aggStale} days old. Run refresh-aggregates to update.
              </p>
            )}
          </div>
        )}
        {aggRows === 0 && (
          <p className="pulse-text-empty">
            No aggregated data yet. Aggregates are created when refresh-aggregates runs.
          </p>
        )}
      </Card>

      <Card title="Configuration">
        <div className="pulse-kpi-row">
          <Chip label="Site ID" value={siteId} />
          <Chip label="Active Paths" value={formatNumber(distinctPaths)} />
          <Chip label="Active Sessions" value={formatNumber(distinctSessions)} />
        </div>
      </Card>
    </div>
  );
}
