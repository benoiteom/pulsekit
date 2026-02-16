"use client";

import React, { useState } from "react";
import type { AggregatesOverview } from "@pulsekit/core";

const PAGE_SIZE = 10;

export interface PulseAggregatesProps {
  data: AggregatesOverview;
}

function KpiChip({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-lg px-4 py-3 flex-1 min-w-[120px]"
      style={{ border: "1px solid var(--pulse-border)" }}
    >
      <div className="text-xs font-medium" style={{ color: "var(--pulse-fg-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: "var(--pulse-fg)" }}>
        {value}
      </div>
    </div>
  );
}

export function PulseAggregates({ data }: PulseAggregatesProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE);
  const pageRows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex gap-3 flex-wrap mb-5">
        <KpiChip label="Consolidated rows" value={data.totalRows} />
        <KpiChip label="Total views" value={data.totalViews} />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="text-left py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Date
            </th>
            <th
              className="text-left py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Path
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
          {pageRows.map((row, i) => (
            <tr key={`${row.date}-${row.path}-${i}`} className="pulse-table-row">
              <td
                className="py-2 text-sm"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {row.date}
              </td>
              <td
                className="py-2 text-xs font-mono"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {row.path}
              </td>
              <td
                className="text-right py-2 text-sm"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {row.totalViews}
              </td>
              <td
                className="text-right py-2 text-sm"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {row.uniqueVisitors}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: "var(--pulse-fg-muted)" }}>
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, data.rows.length)} of {data.rows.length} rows
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="px-3 py-1 text-xs rounded"
              style={{
                border: "1px solid var(--pulse-border)",
                color: page === 0 ? "var(--pulse-border)" : "var(--pulse-fg)",
                background: "transparent",
                cursor: page === 0 ? "default" : "pointer",
              }}
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-xs rounded"
              style={{
                border: "1px solid var(--pulse-border)",
                color: page >= totalPages - 1 ? "var(--pulse-border)" : "var(--pulse-fg)",
                background: "transparent",
                cursor: page >= totalPages - 1 ? "default" : "pointer",
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
