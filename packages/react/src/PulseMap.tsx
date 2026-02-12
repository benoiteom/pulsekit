"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export interface PulseMapProps {
  data: {
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    totalViews: number;
    uniqueVisitors: number;
  }[];
}

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function bubbleRadius(views: number, maxViews: number): number {
  if (maxViews === 0) return 4;
  // Scale from 4px to 20px based on sqrt (area-proportional)
  return 4 + 16 * Math.sqrt(views / maxViews);
}

export function PulseMap({ data }: PulseMapProps): React.ReactElement {
  // Defer map rendering to client — d3-geo projections produce slightly different
  // floating-point results between Node.js and the browser, causing hydration mismatches.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Markers: only rows that have coordinates
  const { markers, maxViews } = useMemo(() => {
    const items = data.filter(
      (r): r is typeof r & { latitude: number; longitude: number } =>
        r.latitude != null && r.longitude != null
    );
    let max = 0;
    for (const m of items) {
      if (m.totalViews > max) max = m.totalViews;
    }
    return { markers: items, maxViews: max };
  }, [data]);

  // Table rows: show city-level detail, sorted by views
  const tableRows = useMemo(() => {
    return data
      .map((row) => ({
        country: row.country,
        countryName: countryName(row.country),
        city: row.city,
        views: row.totalViews,
        unique: row.uniqueVisitors,
      }))
      .sort((a, b) => b.views - a.views);
  }, [data]);

  return (
    <div>
      <div style={{ width: "100%", height: "auto", overflow: "hidden" }}>
        {!mounted ? (
          <div style={{ height: 400 }} />
        ) : (
        <ComposableMap
          projectionConfig={{ scale: 147 }}
          width={800}
          height={400}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#f0f0f0"
                  stroke="#d1d5db"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((m, i) => (
            <Marker
              key={`${m.country}-${m.city ?? "unknown"}-${i}`}
              coordinates={[m.longitude, m.latitude]}
            >
              <circle
                r={bubbleRadius(m.totalViews, maxViews)}
                fill="rgba(99, 102, 241, 0.6)"
                stroke="rgba(99, 102, 241, 0.9)"
                strokeWidth={1}
              />
            </Marker>
          ))}
        </ComposableMap>
        )}
      </div>

      {tableRows.length > 0 && (
        <table
          style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}
        >
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
                Location
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
            {tableRows.map((row, i) => (
              <tr key={`${row.country}-${row.city ?? "unknown"}-${i}`}>
                <td
                  style={{
                    padding: "8px 0",
                    fontSize: 14,
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {row.city
                    ? `${row.city}, ${row.countryName}`
                    : row.countryName}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    fontSize: 14,
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {row.views}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    padding: "8px 0",
                    fontSize: 14,
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  {row.unique}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
