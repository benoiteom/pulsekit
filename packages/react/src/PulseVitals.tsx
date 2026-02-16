"use client";

import React from "react";
import type { VitalsOverview, WebVitalStat, WebVitalRating } from "@pulsekit/core";

export interface PulseVitalsProps {
  data: VitalsOverview;
}

const METRIC_LABELS: Record<string, { label: string; unit: string; description: string }> = {
  lcp: { label: "LCP", unit: "ms", description: "Largest Contentful Paint — time until the biggest visible element loads" },
  inp: { label: "INP", unit: "ms", description: "Interaction to Next Paint — responsiveness to user input" },
  cls: { label: "CLS", unit: "", description: "Cumulative Layout Shift — how much the page layout moves around" },
  fcp: { label: "FCP", unit: "ms", description: "First Contentful Paint — time until first text or image appears" },
  ttfb: { label: "TTFB", unit: "ms", description: "Time to First Byte — server response time" },
};

const METRIC_ORDER = ["lcp", "inp", "cls", "fcp", "ttfb"];

const RATING_STYLES: Record<WebVitalRating, { bg: string; fg: string; badge: string }> = {
  good: { bg: "var(--pulse-vital-good-bg)", fg: "var(--pulse-vital-good-fg)", badge: "Good" },
  "needs-improvement": { bg: "var(--pulse-vital-warn-bg)", fg: "var(--pulse-vital-warn-fg)", badge: "Needs work" },
  poor: { bg: "var(--pulse-vital-poor-bg)", fg: "var(--pulse-vital-poor-fg)", badge: "Poor" },
};

function formatValue(metric: string, value: number): string {
  if (metric === "cls") return value.toFixed(3);
  return Math.round(value).toString();
}

function RatingBadge({ rating }: { rating: WebVitalRating }) {
  const s = RATING_STYLES[rating];
  return (
    <span
      className="inline-block px-2 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.fg, paddingTop: 2, paddingBottom: 2 }}
    >
      {s.badge}
    </span>
  );
}

function VitalCard({ stat }: { stat: WebVitalStat }) {
  const info = METRIC_LABELS[stat.metric] ?? { label: stat.metric.toUpperCase(), unit: "", description: "" };
  const s = RATING_STYLES[stat.rating];

  return (
    <div
      className="rounded-lg p-4 flex-1 min-w-[140px]"
      style={{
        border: "1px solid var(--pulse-border)",
        backgroundColor: s.bg,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div
          title={info.description}
          className="text-xs font-medium cursor-help"
          style={{ color: "var(--pulse-fg-muted)" }}
        >
          {info.label}
        </div>
        <span className="text-[11px]" style={{ color: "var(--pulse-fg-muted)" }}>
          {stat.sampleCount} sample{stat.sampleCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold" style={{ color: s.fg }}>
          {formatValue(stat.metric, stat.p75)}
          {info.unit && (
            <span className="text-xs font-normal ml-0.5">{info.unit}</span>
          )}
        </span>
        <RatingBadge rating={stat.rating} />
      </div>
    </div>
  );
}

function CellValue({ stat }: { stat: WebVitalStat | undefined }) {
  if (!stat) {
    return <span style={{ color: "var(--pulse-border)" }}>--</span>;
  }
  const s = RATING_STYLES[stat.rating];
  return (
    <span className="font-medium" style={{ color: s.fg }}>
      {formatValue(stat.metric, stat.p75)}
    </span>
  );
}

export function PulseVitals({ data }: PulseVitalsProps) {
  const overallMap = new Map<string, WebVitalStat>();
  for (const stat of data.overall) {
    overallMap.set(stat.metric, stat);
  }

  return (
    <div>
      {/* Site-wide overview cards */}
      <div className="flex gap-3 flex-wrap mb-5">
        {METRIC_ORDER.map((metric) => {
          const stat = overallMap.get(metric);
          if (!stat) return null;
          return <VitalCard key={metric} stat={stat} />;
        })}
      </div>

      {/* Per-page breakdown table */}
      {data.byPage.length > 0 && (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                className="text-left py-2 text-sm font-medium"
                style={{ borderBottom: "1px solid var(--pulse-border)" }}
              >
                Page
              </th>
              {METRIC_ORDER.map((metric) => (
                <th
                  key={metric}
                  className="text-right py-2 px-2 text-sm font-medium"
                  style={{ borderBottom: "1px solid var(--pulse-border)" }}
                >
                  {METRIC_LABELS[metric]?.label ?? metric.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.byPage.map((page) => (
              <tr key={page.path} className="pulse-table-row">
                <td
                  className="py-2 text-xs font-mono"
                  style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                >
                  {page.path}
                </td>
                {METRIC_ORDER.map((metric) => (
                  <td
                    key={metric}
                    className="text-right py-2 px-2 text-sm"
                    style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                  >
                    <CellValue stat={page.vitals[metric]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
