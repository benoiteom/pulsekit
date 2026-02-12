import React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPulseStats, getPulseVitals, type Timeframe } from "@pulsekit/core";
import { PulseChart } from "./PulseChart";
import { PulseMap } from "./PulseMap";
import { PulseVitals } from "./PulseVitals";
import { RefreshButton } from "./RefreshButton";

export interface PulseDashboardProps {
  supabase: SupabaseClient;
  siteId: string;
  timeframe?: Timeframe;
  timezone?: string;
  refreshEndpoint?: string;
}

export async function PulseDashboard({
  supabase,
  siteId,
  timeframe = "7d",
  timezone,
  refreshEndpoint,
}: PulseDashboardProps) {
  const [stats, vitals] = await Promise.all([
    getPulseStats({ supabase, siteId, timeframe, timezone }),
    getPulseVitals({ supabase, siteId, timeframe }).catch((err) => {
      console.error("getPulseVitals failed:", err);
      return { overall: [], byPage: [] };
    }),
  ]);

  return (
    <div style={{ maxWidth: 896, margin: "0 auto", padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Pulse Analytics</h1>
        <RefreshButton endpoint={refreshEndpoint} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Traffic over time
            </h2>
          </div>
          <div style={{ padding: 20 }}>
            {stats.daily.length === 0 ? (
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                No analytics data yet. Visit your site and refresh aggregates.
              </p>
            ) : (
              <PulseChart data={stats.daily} />
            )}
          </div>
        </section>

        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              Top pages
            </h2>
          </div>
          <div style={{ padding: 20 }}>
            {stats.topPages.length === 0 ? (
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                No page data available for this timeframe.
              </p>
            ) : (
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
                      Path
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 0",
                        fontSize: 14,
                        fontWeight: 500,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Views
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "8px 0",
                        fontSize: 14,
                        fontWeight: 500,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      Unique
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topPages.map((p) => (
                    <tr key={p.path}>
                      <td
                        style={{
                          padding: "8px 0",
                          fontSize: 12,
                          fontFamily: "monospace",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {p.path}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontSize: 14,
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {p.totalViews}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "8px 0",
                          fontSize: 14,
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        {p.uniqueVisitors}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        {vitals.overall.length > 0 && (
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                Web Vitals
              </h2>
            </div>
            <div style={{ padding: 20 }}>
              <PulseVitals data={vitals} />
            </div>
          </section>
        )}
        {stats.locations.length > 0 && (
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
                Visitors by location
              </h2>
            </div>
            <div style={{ padding: 20 }}>
              <PulseMap data={stats.locations} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
