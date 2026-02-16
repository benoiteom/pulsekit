"use client";

import Link from "next/link";
import { useState } from "react";

export default function Test() {
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  async function seedErrors() {
    setSeedStatus("Seeding...");
    const res = await fetch("/api/pulse/seed-errors", { method: "POST" });
    const data = await res.json();
    setSeedStatus(res.ok ? `Inserted ${data.inserted} test errors` : `Error: ${data.error}`);
  }

  function triggerError() {
    // This will be caught by window.addEventListener("error") in PulseTracker
    throw new Error("Test error from button click");
  }

  function triggerTypeError() {
    const obj = null as unknown as { foo: { bar: () => void } };
    obj.foo.bar();
  }

  function triggerUnhandledRejection() {
    // This will be caught by window.addEventListener("unhandledrejection") in PulseTracker
    Promise.reject(new Error("Test unhandled promise rejection"));
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1 style={{ marginBottom: "1rem" }}>Error Testing Page</h1>
      <p style={{ marginBottom: "2rem", color: "#666" }}>
        Use the buttons below to test PulseKit error monitoring.
        Errors are captured by <code>PulseTracker</code> and sent to <code>/api/pulse</code>.
      </p>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Seed test data</h2>
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.5rem" }}>
          Insert sample error events directly into the database.
        </p>
        <button
          onClick={seedErrors}
          style={{
            padding: "0.5rem 1rem",
            background: "#6366f1",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Seed error data
        </button>
        {seedStatus && (
          <span style={{ marginLeft: "0.75rem", fontSize: "0.875rem", color: "#666" }}>
            {seedStatus}
          </span>
        )}
      </section>

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Trigger live errors</h2>
        <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.5rem" }}>
          These fire real browser errors that PulseTracker will capture.
        </p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            onClick={triggerError}
            style={{
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Throw Error
          </button>
          <button
            onClick={triggerTypeError}
            style={{
              padding: "0.5rem 1rem",
              background: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Throw TypeError
          </button>
          <button
            onClick={triggerUnhandledRejection}
            style={{
              padding: "0.5rem 1rem",
              background: "#f97316",
              color: "white",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Unhandled Rejection
          </button>
        </div>
      </section>

      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <Link href="/">Home</Link>
        <Link href="/admin/analytics">View Dashboard</Link>
      </div>
    </main>
  );
}
