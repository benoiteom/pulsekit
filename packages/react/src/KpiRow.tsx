import React from "react";

export interface KpiRowProps {
  totalViews: number;
  uniqueVisitors: number;
  avgPerDay: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return n.toString();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="pulse-chip"
      style={{ backgroundColor: "var(--pulse-kpi-bg)" }}
    >
      <div className="pulse-chip-label">{label}</div>
      <div className="pulse-chip-value" style={{ color: "var(--pulse-brand)" }}>
        {value}
      </div>
    </div>
  );
}

export function KpiRow({ totalViews, uniqueVisitors, avgPerDay }: KpiRowProps) {
  return (
    <div className="pulse-kpi-row">
      <Stat label="Total Views" value={formatNumber(totalViews)} />
      <Stat label="Unique Visitors" value={formatNumber(uniqueVisitors)} />
      <Stat label="Avg / Day" value={formatNumber(avgPerDay)} />
    </div>
  );
}
