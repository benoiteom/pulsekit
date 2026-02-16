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
  return 4 + 16 * Math.sqrt(views / maxViews);
}

export function PulseMap({ data }: PulseMapProps): React.ReactElement {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR mount guard
  useEffect(() => setMounted(true), []);

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
      <div className="w-full overflow-hidden">
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
                  fill="var(--pulse-map-land)"
                  stroke="var(--pulse-map-land-stroke)"
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
                fill="var(--pulse-map-marker)"
                stroke="var(--pulse-map-marker-stroke)"
                strokeWidth={1}
              />
            </Marker>
          ))}
        </ComposableMap>
        )}
      </div>

      {tableRows.length > 0 && (
        <table className="w-full border-collapse mt-4">
          <thead>
            <tr>
              <th
                className="text-left py-2 text-sm font-medium"
                style={{ borderBottom: "1px solid var(--pulse-border)" }}
              >
                Location
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
            {tableRows.map((row, i) => (
              <tr
                key={`${row.country}-${row.city ?? "unknown"}-${i}`}
                className="pulse-table-row"
              >
                <td
                  className="py-2 text-sm"
                  style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                >
                  {row.city
                    ? `${row.city}, ${row.countryName}`
                    : row.countryName}
                </td>
                <td
                  className="text-right py-2 text-sm"
                  style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                >
                  {row.views}
                </td>
                <td
                  className="text-right py-2 text-sm"
                  style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
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
