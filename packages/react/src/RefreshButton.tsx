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
      style={{
        padding: "6px 12px",
        fontSize: "14px",
        borderRadius: "6px",
        border: "1px solid #d1d5db",
        background: "transparent",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? "Refreshing..." : "Refresh data"}
    </button>
  );
}
