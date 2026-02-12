import Link from "next/link";

export default function Test() {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Test Page</h1>
        <p>
          This is a test page.
        </p>
        <Link href="/">Home</Link>
      </main>
    );
  }
  