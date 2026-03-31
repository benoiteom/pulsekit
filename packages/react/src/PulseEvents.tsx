"use client";

import React, { useState } from "react";
import type { EventsOverview } from "@pulsekit/core";

const PAGE_SIZE = 50;

export interface PulseEventsFilters {
  eventType: string;
  path: string;
  sessionId: string;
  page: number;
}

export interface PulseEventsProps {
  data: EventsOverview;
  filters: PulseEventsFilters;
}

const EVENT_TYPES = [
  { value: "", label: "All types" },
  { value: "pageview", label: "Pageview" },
  { value: "vitals", label: "Vitals" },
  { value: "error", label: "Error" },
  { value: "server_error", label: "Server error" },
  { value: "custom", label: "Custom" },
];

function TypeBadge({ type }: { type: string }) {
  let bg = "var(--pulse-kpi-bg)";
  let fg = "var(--pulse-brand)";
  if (type === "error") {
    bg = "var(--pulse-vital-poor-bg)";
    fg = "var(--pulse-vital-poor-fg)";
  } else if (type === "server_error") {
    bg = "var(--pulse-vital-warn-bg)";
    fg = "var(--pulse-vital-warn-fg)";
  } else if (type === "vitals") {
    bg = "var(--pulse-vital-good-bg)";
    fg = "var(--pulse-vital-good-fg)";
  }
  return (
    <span className="pulse-badge" style={{ backgroundColor: bg, color: fg }}>
      {type === "server_error" ? "server" : type}
    </span>
  );
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const seconds = d.getSeconds().toString().padStart(2, "0");
  return `${month} ${day} ${hours}:${minutes}:${seconds}`;
}

function truncateMeta(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const str = JSON.stringify(meta);
  return str.length > 60 ? str.slice(0, 60) + "..." : str;
}

function navigate(filters: PulseEventsFilters) {
  const url = new URL(window.location.href);
  // Preserve existing params (tab, range, from, to)
  if (filters.eventType) {
    url.searchParams.set("eventType", filters.eventType);
  } else {
    url.searchParams.delete("eventType");
  }
  if (filters.path) {
    url.searchParams.set("eventPath", filters.path);
  } else {
    url.searchParams.delete("eventPath");
  }
  if (filters.sessionId) {
    url.searchParams.set("eventSession", filters.sessionId);
  } else {
    url.searchParams.delete("eventSession");
  }
  if (filters.page > 0) {
    url.searchParams.set("eventPage", String(filters.page));
  } else {
    url.searchParams.delete("eventPage");
  }
  window.location.assign(url.toString());
}

export function PulseEvents({ data, filters }: PulseEventsProps) {
  const [localType, setLocalType] = useState(filters.eventType);
  const [localPath, setLocalPath] = useState(filters.path);
  const [localSession, setLocalSession] = useState(filters.sessionId);

  const totalPages = Math.ceil(data.totalCount / PAGE_SIZE);
  const hasFilters = filters.eventType || filters.path || filters.sessionId;

  function handleApply() {
    navigate({ eventType: localType, path: localPath, sessionId: localSession, page: 0 });
  }

  function handleClear() {
    navigate({ eventType: "", path: "", sessionId: "", page: 0 });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleApply();
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="pulse-events-filters">
        <select
          className="pulse-events-select"
          value={localType}
          onChange={(e) => setLocalType(e.target.value)}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <input
          className="pulse-events-input"
          type="text"
          placeholder="Filter by path"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <input
          className="pulse-events-input"
          type="text"
          placeholder="Filter by session"
          value={localSession}
          onChange={(e) => setLocalSession(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="pulse-events-apply" onClick={handleApply}>
          Apply
        </button>
        {hasFilters && (
          <button className="pulse-events-clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      {data.events.length === 0 ? (
        <p className="pulse-text-empty" style={{ marginTop: "1rem" }}>
          {hasFilters ? "No events match the current filters." : "No events recorded in this period."}
        </p>
      ) : (
        <>
          <table className="pulse-table">
            <thead>
              <tr>
                <th className="pulse-th">Time</th>
                <th className="pulse-th">Type</th>
                <th className="pulse-th">Path</th>
                <th className="pulse-th">Session</th>
                <th className="pulse-th">Country</th>
                <th className="pulse-th">Meta</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.id} className="pulse-table-row">
                  <td className="pulse-td pulse-td--nowrap" title={event.createdAt}>
                    {formatTime(event.createdAt)}
                  </td>
                  <td className="pulse-td">
                    <TypeBadge type={event.eventType} />
                  </td>
                  <td className="pulse-td pulse-td--mono">{event.path}</td>
                  <td className="pulse-td pulse-td--mono" title={event.sessionId}>
                    {event.sessionId ? event.sessionId.slice(0, 8) + "..." : ""}
                  </td>
                  <td className="pulse-td">{event.country || ""}</td>
                  <td className="pulse-td pulse-td--mono pulse-td--truncate" title={event.meta ? JSON.stringify(event.meta) : ""}>
                    {truncateMeta(event.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pulse-pagination">
            <span className="pulse-pagination-info">
              {filters.page * PAGE_SIZE + 1}&ndash;{Math.min((filters.page + 1) * PAGE_SIZE, data.totalCount)} of {data.totalCount.toLocaleString()} events
            </span>
            <div className="pulse-pagination-buttons">
              <button
                onClick={() => navigate({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 0}
                className="pulse-pagination-btn"
              >
                Prev
              </button>
              <button
                onClick={() => navigate({ ...filters, page: filters.page + 1 })}
                disabled={filters.page >= totalPages - 1}
                className="pulse-pagination-btn"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
