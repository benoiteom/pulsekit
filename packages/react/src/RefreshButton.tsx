"use client";

import React, { useState } from "react";

export interface RefreshButtonProps {
  endpoint?: string;
}

export function RefreshButton({
  endpoint = "/api/pulse/refresh-aggregates",
}: RefreshButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await fetch(endpoint, { method: "POST" });
        setLoading(false);
        window.location.reload();
      }}
      className="pulse-btn pulse-datepicker-trigger"
      style={{
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        style={{ opacity: 0.5, flexShrink: 0 }}
      >
        <path
          d="M13.5 8a5.5 5.5 0 01-9.55 3.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M2.5 8a5.5 5.5 0 019.55-3.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M12.5 1.5v3h-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3.5 14.5v-3h3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {loading ? "Refreshing\u2026" : "Refresh data"}
    </button>
  );
}
