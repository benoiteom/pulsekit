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

const RATING_COLORS: Record<WebVitalRating, { bg: string; text: string; badge: string }> = {
  good: { bg: "#f0fdf4", text: "#15803d", badge: "Good" },
  "needs-improvement": { bg: "#fefce8", text: "#a16207", badge: "Needs work" },
  poor: { bg: "#fef2f2", text: "#dc2626", badge: "Poor" },
};

function formatValue(metric: string, value: number): string {
  if (metric === "cls") return value.toFixed(3);
  return Math.round(value).toString();
}

function RatingBadge({ rating }: { rating: WebVitalRating }) {
  const colors = RATING_COLORS[rating];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {colors.badge}
    </span>
  );
}

function VitalCard({ stat }: { stat: WebVitalStat }) {
  const info = METRIC_LABELS[stat.metric] ?? { label: stat.metric.toUpperCase(), unit: "" };
  const colors = RATING_COLORS[stat.rating];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        flex: "1 1 0",
        minWidth: 140,
        backgroundColor: colors.bg,
      }}
    >
      <div
        title={info.description}
        style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 4, cursor: "help" }}
      >
        {info.label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: colors.text }}>
        {formatValue(stat.metric, stat.p75)}
        {info.unit && (
          <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>{info.unit}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
        <RatingBadge rating={stat.rating} />
        <span style={{ fontSize: 11, color: "#9ca3af" }}>
          {stat.sampleCount} sample{stat.sampleCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function CellValue({ stat }: { stat: WebVitalStat | undefined }) {
  if (!stat) {
    return <span style={{ color: "#d1d5db" }}>--</span>;
  }
  const colors = RATING_COLORS[stat.rating];
  return (
    <span style={{ color: colors.text, fontWeight: 500 }}>
      {formatValue(stat.metric, stat.p75)}
    </span>
  );
}

export function PulseVitals({ data }: PulseVitalsProps) {
  // Build a map for quick lookup of overall stats
  const overallMap = new Map<string, WebVitalStat>();
  for (const stat of data.overall) {
    overallMap.set(stat.metric, stat);
  }

  return (
    <div>
      {/* Site-wide overview cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {METRIC_ORDER.map((metric) => {
          const stat = overallMap.get(metric);
          if (!stat) return null;
          return <VitalCard key={metric} stat={stat} />;
        })}
      </div>

      {/* Per-page breakdown table */}
      {data.byPage.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "8px 0",
                  fontSize: 14,
                  fontWeight: 500,
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                Page
              </th>
              {METRIC_ORDER.map((metric) => (
                <th
                  key={metric}
                  style={{
                    textAlign: "right",
                    padding: "8px 8px",
                    fontSize: 14,
                    fontWeight: 500,
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  {METRIC_LABELS[metric]?.label ?? metric.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.byPage.map((page) => (
              <tr key={page.path}>
                <td
                  style={{
                    padding: "8px 0",
                    fontSize: 12,
                    fontFamily: "monospace",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {page.path}
                </td>
                {METRIC_ORDER.map((metric) => (
                  <td
                    key={metric}
                    style={{
                      textAlign: "right",
                      padding: "8px 8px",
                      fontSize: 14,
                      borderBottom: "1px solid #f3f4f6",
                    }}
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
