"use client";

import React from "react";

export interface PulseTimeToggleProps {
  value: "7d" | "30d";
}

export function PulseTimeToggle({ value }: PulseTimeToggleProps) {
  function handleClick(range: "7d" | "30d") {
    if (range === value) return;
    const url = new URL(window.location.href);
    url.searchParams.set("range", range);
    window.location.assign(url.toString());
  }

  return (
    <div className="pulse-time-toggle">
      <button
        className={`pulse-time-toggle-btn${value === "7d" ? " pulse-time-toggle-btn--active" : ""}`}
        onClick={() => handleClick("7d")}
      >
        7 days
      </button>
      <button
        className={`pulse-time-toggle-btn${value === "30d" ? " pulse-time-toggle-btn--active" : ""}`}
        onClick={() => handleClick("30d")}
      >
        30 days
      </button>
    </div>
  );
}
