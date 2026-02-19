"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PulseIcon } from "./PulseIcon.js";

export interface PulseLoginFormProps {
  /** Auth endpoint URL. Defaults to "/api/pulse/auth". */
  authEndpoint?: string;
}

export function PulseLoginForm({
  authEndpoint = "/api/pulse/auth",
}: PulseLoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(authEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Incorrect password");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.header}>
          <PulseIcon size={32} />
          <h1 style={styles.title}>PulseKit</h1>
        </div>
        <p style={styles.subtitle}>Enter your password to view analytics.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
          style={styles.input}
        />
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    padding: "1rem",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    width: "100%",
    maxWidth: "360px",
    padding: "2rem",
    borderRadius: "var(--pulse-radius, 0.5rem)",
    border: "1px solid var(--pulse-border, #e5e7eb)",
    background: "var(--pulse-bg, #ffffff)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  title: {
    fontSize: "1.25rem",
    fontWeight: 600,
    margin: 0,
    color: "var(--pulse-fg, #111827)",
  },
  subtitle: {
    fontSize: "0.875rem",
    color: "var(--pulse-fg-muted, #6b7280)",
    margin: 0,
  },
  input: {
    padding: "0.5rem 0.75rem",
    borderRadius: "var(--pulse-radius, 0.5rem)",
    border: "1px solid var(--pulse-border, #e5e7eb)",
    fontSize: "0.875rem",
    outline: "none",
    background: "transparent",
    color: "var(--pulse-fg, #111827)",
  },
  error: {
    fontSize: "0.8125rem",
    color: "var(--pulse-vital-poor-fg, #dc2626)",
    margin: 0,
  },
  button: {
    padding: "0.5rem 1rem",
    borderRadius: "var(--pulse-radius, 0.5rem)",
    border: "none",
    background: "var(--pulse-brand, #7C3AED)",
    color: "#ffffff",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
  },
};
