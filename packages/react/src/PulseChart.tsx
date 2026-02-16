"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface PulseChartProps {
  data: {
    date: string;
    totalViews: number;
    uniqueVisitors: number;
  }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PulseChart({ data }: PulseChartProps): React.ReactElement | null {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--pulse-border)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          fontSize={12}
          stroke="var(--pulse-fg-muted)"
        />
        <YAxis
          fontSize={12}
          stroke="var(--pulse-fg-muted)"
          allowDecimals={false}
        />
        <Tooltip
          labelFormatter={formatDate}
          contentStyle={{
            backgroundColor: "var(--pulse-bg)",
            border: "1px solid var(--pulse-border)",
            borderRadius: "var(--pulse-radius)",
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="totalViews"
          name="Views"
          stroke="var(--pulse-chart-1)"
          fill="var(--pulse-chart-1)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="uniqueVisitors"
          name="Unique visitors"
          stroke="var(--pulse-chart-2)"
          fill="var(--pulse-chart-2)"
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
