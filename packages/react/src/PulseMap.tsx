"use client";

import React, { useEffect, useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const WIDTH = 800;
const HEIGHT = 400;

const projection = geoNaturalEarth1()
  .scale(147)
  .translate([WIDTH / 2, HEIGHT / 2]);

const pathGenerator = geoPath(projection);

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
  const [geographies, setGeographies] = useState<GeoJSON.Feature[]>([]);

  useEffect(() => {
    fetch(GEO_URL)
      .then((res) => res.json())
      .then((topology: Topology) => {
        const countries = feature(
          topology,
          topology.objects.countries as GeometryCollection
        );
        setGeographies(countries.features);
      });
  }, []);

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
      <div className="pulse-map-container">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <g>
            {geographies.map((geo, i) => (
              <path
                key={geo.id ?? i}
                d={pathGenerator(geo) ?? ""}
                fill="var(--pulse-map-land)"
                stroke="var(--pulse-map-land-stroke)"
                strokeWidth={0.5}
              />
            ))}
          </g>
          <g>
            {markers.map((m, i) => {
              const coords = projection([m.longitude, m.latitude]);
              if (!coords) return null;
              return (
                <circle
                  key={`${m.country}-${m.city ?? "unknown"}-${i}`}
                  cx={coords[0]}
                  cy={coords[1]}
                  r={bubbleRadius(m.totalViews, maxViews)}
                  fill="var(--pulse-map-marker)"
                  stroke="var(--pulse-map-marker-stroke)"
                  strokeWidth={1}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {tableRows.length > 0 && (
        <table className="pulse-map-table">
          <thead>
            <tr>
              <th className="pulse-th">Location</th>
              <th className="pulse-th pulse-th--right">Views</th>
              <th className="pulse-th pulse-th--right">Unique</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr
                key={`${row.country}-${row.city ?? "unknown"}-${i}`}
                className="pulse-table-row"
              >
                <td className="pulse-td">
                  {row.city
                    ? `${row.city}, ${row.countryName}`
                    : row.countryName}
                </td>
                <td className="pulse-td pulse-td--right">{row.views}</td>
                <td className="pulse-td pulse-td--right">{row.unique}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
