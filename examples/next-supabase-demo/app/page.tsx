import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Pulse Analytics Demo</h1>
      <p>
        This page sends a <code>pageview</code> event to{" "}
        <code>/api/pulse</code> on load.
      </p>
      <p>
        Check your <code>pulse_events</code> table in Supabase to see the
        recorded event.
      </p>
      <Link href="/test">Test</Link>
    </main>
  );
}
