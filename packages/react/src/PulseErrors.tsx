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
      className="inline-block px-2 rounded-full text-[11px] font-semibold"
      style={{
        backgroundColor: isServer ? "var(--pulse-vital-warn-bg)" : "var(--pulse-vital-poor-bg)",
        color: isServer ? "var(--pulse-vital-warn-fg)" : "var(--pulse-vital-poor-fg)",
        paddingTop: 2,
        paddingBottom: 2,
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
    <div
      className="rounded-lg px-4 py-3 flex-1 min-w-[120px]"
      style={{ border: "1px solid var(--pulse-border)", backgroundColor: color }}
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

export function PulseErrors({ data }: PulseErrorsProps) {
  const [page, setPage] = useState(0);

  if (data.totalErrorCount === 0) {
    return (
      <p className="text-sm m-0" style={{ color: "var(--pulse-fg-muted)" }}>
        No errors recorded in this timeframe.
      </p>
    );
  }

  const totalPages = Math.ceil(data.errors.length / PAGE_SIZE);
  const pageErrors = data.errors.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ height: 582 }}>
      <div className="flex gap-3 flex-wrap mb-5">
        <KpiChip label="Total errors" value={data.totalErrorCount} color="var(--pulse-vital-poor-bg)" />
        <KpiChip label="Client errors" value={data.totalFrontendErrors} color="var(--pulse-vital-poor-bg)" />
        <KpiChip label="Server errors" value={data.totalServerErrors} color="var(--pulse-vital-warn-bg)" />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className="text-left py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Type
            </th>
            <th
              className="text-left py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Message
            </th>
            <th
              className="text-left py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Page
            </th>
            <th
              className="text-right py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Count
            </th>
            <th
              className="text-right py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Sessions
            </th>
            <th
              className="text-right py-2 text-sm font-medium"
              style={{ borderBottom: "1px solid var(--pulse-border)" }}
            >
              Last seen
            </th>
          </tr>
        </thead>
        <tbody>
          {pageErrors.map((err, i) => (
            <tr key={`${err.errorType}-${err.message}-${err.path}-${i}`} className="pulse-table-row">
              <td
                className="py-2"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                <TypeBadge type={err.errorType} />
              </td>
              <td
                className="py-2 text-xs font-mono max-w-[300px] truncate"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
                title={err.message}
              >
                {err.message.length > 80 ? err.message.slice(0, 80) + "..." : err.message}
              </td>
              <td
                className="py-2 text-xs font-mono"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {err.path}
              </td>
              <td
                className="text-right py-2 text-sm"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {err.totalCount}
              </td>
              <td
                className="text-right py-2 text-sm"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {err.sessionCount}
              </td>
              <td
                className="text-right py-2 text-sm whitespace-nowrap"
                style={{ borderBottom: "1px solid var(--pulse-border-light)" }}
              >
                {formatRelativeTime(err.lastSeen)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: "var(--pulse-fg-muted)" }}>
            {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, data.errors.length)} of {data.errors.length} errors
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
