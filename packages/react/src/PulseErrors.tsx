"use client";

import React, { useState } from "react";
import type { ErrorsOverview } from "@pulsekit/core";

const PAGE_SIZE = 10;

export interface PulseErrorsProps {
  data: ErrorsOverview;
}

function TypeBadge({ type }: { type: string }) {
  const isServer = type === "server_error";
  return (
    <span
      className="pulse-badge"
      style={{
        backgroundColor: isServer ? "var(--pulse-vital-warn-bg)" : "var(--pulse-vital-poor-bg)",
        color: isServer ? "var(--pulse-vital-warn-fg)" : "var(--pulse-vital-poor-fg)",
      }}
    >
      {isServer ? "Server" : "Client"}
    </span>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function KpiChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="pulse-chip" style={{ backgroundColor: color }}>
      <div className="pulse-chip-label">{label}</div>
      <div className="pulse-chip-value">{value}</div>
    </div>
  );
}

export function PulseErrors({ data }: PulseErrorsProps) {
  const [page, setPage] = useState(0);

  if (data.totalErrorCount === 0) {
    return (
      <p className="pulse-text-empty">
        No errors recorded in this timeframe.
      </p>
    );
  }

  const totalPages = Math.ceil(data.errors.length / PAGE_SIZE);
  const pageErrors = data.errors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ height: 582 }}>
      <div className="pulse-chip-row">
        <KpiChip label="Total errors" value={data.totalErrorCount} color="var(--pulse-vital-poor-bg)" />
        <KpiChip label="Client errors" value={data.totalFrontendErrors} color="var(--pulse-vital-poor-bg)" />
        <KpiChip label="Server errors" value={data.totalServerErrors} color="var(--pulse-vital-warn-bg)" />
      </div>

      <table className="pulse-table">
        <thead>
          <tr>
            <th className="pulse-th">Type</th>
            <th className="pulse-th">Message</th>
            <th className="pulse-th">Page</th>
            <th className="pulse-th pulse-th--right">Count</th>
            <th className="pulse-th pulse-th--right">Sessions</th>
            <th className="pulse-th pulse-th--right">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {pageErrors.map((err, i) => (
            <tr key={`${err.errorType}-${err.message}-${err.path}-${i}`} className="pulse-table-row">
              <td className="pulse-td">
                <TypeBadge type={err.errorType} />
              </td>
              <td
                className="pulse-td pulse-td--mono pulse-td--truncate"
                title={err.message}
              >
                {err.message.length > 80 ? err.message.slice(0, 80) + "..." : err.message}
              </td>
              <td className="pulse-td pulse-td--mono">{err.path}</td>
              <td className="pulse-td pulse-td--right">{err.totalCount}</td>
              <td className="pulse-td pulse-td--right">{err.sessionCount}</td>
              <td className="pulse-td pulse-td--right pulse-td--nowrap">
                {formatRelativeTime(err.lastSeen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pulse-pagination">
          <span className="pulse-pagination-info">
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, data.errors.length)} of {data.errors.length} errors
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
