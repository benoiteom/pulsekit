"use client";

import React from "react";
import type { ReferrersOverview } from "@pulsekit/core";

export interface PulseReferrersProps {
  data: ReferrersOverview;
}

export function PulseReferrers({ data }: PulseReferrersProps) {
  if (data.referrers.length === 0) {
    return (
      <p className="pulse-text-empty">
        No referrer data available for this timeframe.
      </p>
    );
  }

  const maxViews = data.referrers[0]?.totalViews ?? 1;

  return (
    <table className="pulse-table">
      <thead>
        <tr>
          <th className="pulse-th">Source</th>
          <th className="pulse-th pulse-th--right">Views</th>
          <th className="pulse-th pulse-th--right">%</th>
        </tr>
      </thead>
      <tbody>
        {data.referrers.map((r) => {
          const pct = maxViews > 0
            ? Math.round((r.totalViews / maxViews) * 100)
            : 0;
          return (
            <tr key={r.referrer} className="pulse-table-row">
              <td className="pulse-td pulse-td--mono">{r.referrer}</td>
              <td className="pulse-td pulse-td--right">{r.totalViews}</td>
              <td className="pulse-td pulse-td--right">{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
