"use client";

import React, { useState } from "react";
import type { AggregatesOverview } from "@pulsekit/core";

const PAGE_SIZE = 10;

export interface PulseAggregatesProps {
  data: AggregatesOverview;
}

function KpiChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="pulse-chip">
      <div className="pulse-chip-label">{label}</div>
      <div className="pulse-chip-value">{value}</div>
    </div>
  );
}

export function PulseAggregates({ data }: PulseAggregatesProps) {
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(data.rows.length / PAGE_SIZE);
  const pageRows = data.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="pulse-chip-row">
        <KpiChip label="Consolidated rows" value={data.totalRows} />
        <KpiChip label="Total views" value={data.totalViews} />
      </div>

      <table className="pulse-table">
        <thead>
          <tr>
            <th className="pulse-th">Date</th>
            <th className="pulse-th">Path</th>
            <th className="pulse-th pulse-th--right">Views</th>
            <th className="pulse-th pulse-th--right">Unique</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={`${row.date}-${row.path}-${i}`} className="pulse-table-row">
              <td className="pulse-td">{row.date}</td>
              <td className="pulse-td pulse-td--mono">{row.path}</td>
              <td className="pulse-td pulse-td--right">{row.totalViews}</td>
              <td className="pulse-td pulse-td--right">{row.uniqueVisitors}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pulse-pagination">
          <span className="pulse-pagination-info">
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, data.rows.length)} of {data.rows.length} rows
          </span>
          <div className="pulse-pagination-buttons">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
              className="pulse-pagination-btn"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
              className="pulse-pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
