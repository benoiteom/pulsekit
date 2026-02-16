import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const SAMPLE_ERRORS = [
  // Client-side errors
  {
    site_id: "demo",
    session_id: "seed-session-1",
    path: "/",
    event_type: "error",
    meta: {
      message: "TypeError: Cannot read properties of undefined (reading 'map')",
      source: "https://example.com/_next/static/chunks/app/page.js",
      lineno: 42,
      colno: 15,
      stack: "TypeError: Cannot read properties of undefined (reading 'map')\n    at ProductList (page.js:42:15)\n    at renderWithHooks (react-dom.js:123:1)",
    },
  },
  {
    site_id: "demo",
    session_id: "seed-session-2",
    path: "/",
    event_type: "error",
    meta: {
      message: "TypeError: Cannot read properties of undefined (reading 'map')",
      source: "https://example.com/_next/static/chunks/app/page.js",
      lineno: 42,
      colno: 15,
      stack: "TypeError: Cannot read properties of undefined (reading 'map')\n    at ProductList (page.js:42:15)\n    at renderWithHooks (react-dom.js:123:1)",
    },
  },
  {
    site_id: "demo",
    session_id: "seed-session-1",
    path: "/test",
    event_type: "error",
    meta: {
      message: "ReferenceError: analytics is not defined",
      source: "https://example.com/_next/static/chunks/app/test/page.js",
      lineno: 18,
      colno: 5,
      stack: "ReferenceError: analytics is not defined\n    at TestPage (page.js:18:5)",
    },
  },
  {
    site_id: "demo",
    session_id: "seed-session-3",
    path: "/test",
    event_type: "error",
    meta: {
      message: "Unhandled promise rejection: NetworkError when attempting to fetch resource",
      source: null,
      lineno: null,
      colno: null,
      stack: null,
    },
  },
  {
    site_id: "demo",
    session_id: "seed-session-4",
    path: "/",
    event_type: "error",
    meta: {
      message: "SyntaxError: Unexpected token '<' in JSON at position 0",
      source: "https://example.com/_next/static/chunks/app/page.js",
      lineno: 87,
      colno: 22,
      stack: "SyntaxError: Unexpected token '<' in JSON at position 0\n    at JSON.parse (<anonymous>)\n    at fetchProducts (page.js:87:22)",
    },
  },
  // Server-side errors
  {
    site_id: "demo",
    session_id: null,
    path: "/api/checkout",
    event_type: "server_error",
    meta: {
      message: "Error: ECONNREFUSED 127.0.0.1:5432 - database connection failed",
      stack: "Error: ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)",
      digest: "NEXT_ERROR_1",
      method: "POST",
      routerKind: "App Router",
      routeType: "route",
      routePath: "/api/checkout",
    },
  },
  {
    site_id: "demo",
    session_id: null,
    path: "/api/checkout",
    event_type: "server_error",
    meta: {
      message: "Error: ECONNREFUSED 127.0.0.1:5432 - database connection failed",
      stack: "Error: ECONNREFUSED 127.0.0.1:5432\n    at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1141:16)",
      digest: "NEXT_ERROR_2",
      method: "POST",
      routerKind: "App Router",
      routeType: "route",
      routePath: "/api/checkout",
    },
  },
  {
    site_id: "demo",
    session_id: null,
    path: "/admin/analytics",
    event_type: "server_error",
    meta: {
      message: "Error: Timeout waiting for Supabase RPC response after 30000ms",
      stack: "Error: Timeout waiting for Supabase RPC response after 30000ms\n    at async Dashboard (page.tsx:12:18)\n    at async getPulseStats (queries.ts:92:24)",
      digest: "NEXT_ERROR_3",
      method: "GET",
      routerKind: "App Router",
      routeType: "page",
      routePath: "/admin/analytics",
    },
  },
  {
    site_id: "demo",
    session_id: null,
    path: "/test",
    event_type: "server_error",
    meta: {
      message: "Error: Dynamic server usage: headers",
      stack: "Error: Dynamic server usage: headers\n    at staticGenerationBailout (static-generation-bailout.ts:25:11)",
      digest: "NEXT_ERROR_4",
      method: "GET",
      routerKind: "App Router",
      routeType: "page",
      routePath: "/test",
    },
  },
];

export async function POST() {
  // Insert with timestamps spread over the last 3 days
  const now = Date.now();
  const rows = SAMPLE_ERRORS.map((event, i) => ({
    ...event,
    created_at: new Date(now - i * 3600_000 * (2 + Math.random() * 10)).toISOString(),
  }));

  const { error } = await supabase
    .schema("analytics")
    .from("pulse_events")
    .insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
