import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>PulseKit Analytics Demo</h1>
      <p>
        This page sends a <code>pageview</code> event to{" "}
        <code>/api/pulse</code> on load.
      </p>
      <p>
        Check your <code>pulse_events</code> table in Supabase to see the
        recorded event.
      </p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <Link href="/test">Error Testing</Link>
        <Link href="/admin/analytics">Dashboard</Link>
      </div>
    </main>
  );
}
