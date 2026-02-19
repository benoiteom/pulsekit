<p align="center">
  <img src="./assets/logo.svg" alt="PulseKit" width="200" />
</p>

<p align="center">
  Web analytics toolkit for Next.js + Supabase
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@pulsekit/core"><img src="https://img.shields.io/npm/v/@pulsekit/core.svg" alt="npm version" /></a>
  <a href="https://github.com/benoiteom/pulsekit/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@pulsekit/core.svg" alt="license" /></a>
  <a href="https://github.com/benoiteom/pulsekit/actions/workflows/ci.yml"><img src="https://github.com/benoiteom/pulsekit/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

PulseKit gives you a self-hosted analytics dashboard inside your Next.js app, backed by Supabase. Track page views, Web Vitals, errors, and visitor geography — no third-party scripts, no external services.

## Table of Contents

- [Quick Start](#quick-start)
- [Packages](#packages)
- [Manual Installation](#manual-installation)
- [Authentication](#authentication)
- [Error Tracking](#error-tracking)
- [Data Lifecycle](#data-lifecycle)
- [Geolocation](#geolocation)
- [Theming](#theming)
- [Configuration Reference](#configuration-reference)
- [Environment Variables](#environment-variables)
- [Compatibility](#compatibility)
- [Development](#development)
- [License](#license)

## Quick Start

Run the setup CLI in an existing Next.js project with Supabase:

```bash
npx create-pulsekit
```

This installs all packages, scaffolds the dashboard route, injects the tracker into your layout, and writes the Supabase migration.

After running, complete the setup:

1. Add your environment variables to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   PULSE_SECRET=<a-secret-at-least-16-characters>
   ```
2. Push the database migration:
   ```bash
   npx supabase link
   npx supabase db push
   ```
3. Start your dev server and visit `/admin/analytics`

## Packages

| Package | Description |
| --- | --- |
| [`@pulsekit/core`](./packages/core) | Core analytics queries, types, and SQL migrations |
| [`@pulsekit/next`](./packages/next) | Next.js API route handlers and client-side tracker |
| [`@pulsekit/react`](./packages/react) | React Server Components for the analytics dashboard |
| [`create-pulsekit`](./packages/create-pulsekit) | CLI scaffolding tool |

The dependency chain is: `@pulsekit/core` &rarr; `@pulsekit/next` &rarr; `@pulsekit/react`

## Manual Installation

If you prefer setting things up manually instead of using the CLI:

```bash
npm install @pulsekit/core @pulsekit/next @pulsekit/react
```

### 1. Create the API routes

The ingestion route receives events from the tracker:

```ts
// app/api/pulse/route.ts
import { createPulseHandler } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export const POST = createPulseHandler({
  supabase,
  config: {
    siteId: "my-site",
    secret: process.env.PULSE_SECRET,
  },
});
```

The auth route handles dashboard login/logout (see [Authentication](#authentication)):

```ts
// app/api/pulse/auth/route.ts
import { createPulseAuthHandler } from "@pulsekit/next";

const handler = createPulseAuthHandler({
  secret: process.env.PULSE_SECRET!,
});

export const POST = handler;
export const DELETE = handler;
```

The refresh-aggregates and consolidate routes power the [data lifecycle](#data-lifecycle):

```ts
// app/api/pulse/refresh-aggregates/route.ts
import { createRefreshHandler, withPulseAuth } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withPulseAuth(createRefreshHandler({ supabase }));
```

```ts
// app/api/pulse/consolidate/route.ts
import { createConsolidateHandler, withPulseAuth } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withPulseAuth(createConsolidateHandler({ supabase }));
```

### 2. Add the tracker to your layout

```tsx
// app/layout.tsx
import { PulseTracker } from "@pulsekit/next/client";
import { createPulseIngestionToken } from "@pulsekit/next";

export default async function RootLayout({ children }) {
  const token = process.env.PULSE_SECRET
    ? await createPulseIngestionToken(process.env.PULSE_SECRET)
    : undefined;

  return (
    <html>
      <body>
        {children}
        <PulseTracker
          excludePaths={["/admin/analytics"]}
          token={token}
        />
      </body>
    </html>
  );
}
```

`@pulsekit/next` has two import paths: `@pulsekit/next` for server-side exports (handlers, auth, error reporter) and `@pulsekit/next/client` for the client-side `PulseTracker` component.

### 3. Add the dashboard page

```tsx
// app/admin/analytics/page.tsx
import { PulseDashboard, PulseAuthGate } from "@pulsekit/react";
import { getPulseTimezone } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";
import "@pulsekit/react/pulse.css";
import type { Timeframe } from "@pulsekit/core";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const timeframe: Timeframe = from && to ? { from, to } : "7d";
  const timezone = await getPulseTimezone();

  return (
    <PulseAuthGate secret={process.env.PULSE_SECRET!}>
      <PulseDashboard
        supabase={supabase}
        siteId="my-site"
        timeframe={timeframe}
        timezone={timezone}
      />
    </PulseAuthGate>
  );
}
```

The dashboard page uses `SUPABASE_SERVICE_ROLE_KEY` because the security hardening migration restricts read access from the `anon` role.

### 4. Run the SQL migrations

Copy the migration files from `node_modules/@pulsekit/core/sql/` into your Supabase migrations directory and run `npx supabase db push`.

## Authentication

PulseKit includes a password-based authentication system to protect the dashboard.

### How it works

1. `PULSE_SECRET` is your shared secret (minimum 16 characters)
2. `createPulseAuthHandler` provides login (`POST`) and logout (`DELETE`) endpoints — it validates the password using timing-safe comparison and sets a signed httpOnly cookie
3. `<PulseAuthGate>` wraps your dashboard page — it reads the cookie server-side and either renders the dashboard or shows a login form
4. `withPulseAuth` is a middleware wrapper for protecting API routes (refresh-aggregates, consolidate) — it accepts either a valid cookie or an `Authorization: Bearer <PULSE_SECRET>` header (useful for cron jobs)

### Ingestion token

When `secret` is set on `createPulseHandler`, all tracking requests must include a valid `x-pulse-token` header. Generate a token server-side and pass it to the tracker:

```tsx
// app/layout.tsx
import { createPulseIngestionToken } from "@pulsekit/next";

const token = await createPulseIngestionToken(process.env.PULSE_SECRET!);
// <PulseTracker token={token} />
```

Tokens are HMAC-SHA256 signed and expire after 24 hours by default (configurable via the second argument in milliseconds).

### Calling protected routes from cron jobs

Routes wrapped with `withPulseAuth` accept an `Authorization` header as an alternative to cookies:

```bash
curl -X POST https://your-app.com/api/pulse/consolidate \
  -H "Authorization: Bearer $PULSE_SECRET"
```

## Error Tracking

PulseKit captures both client-side and server-side errors.

### Client-side errors

The `<PulseTracker>` component automatically captures `window.onerror` and `unhandledrejection` events. Errors are deduplicated by fingerprint (`message|source|lineno`) and capped at 10 unique errors per page session to prevent flooding. Disable with `captureErrors={false}`.

### Server-side errors

Use `createPulseErrorReporter` in your Next.js [instrumentation file](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation) to capture server-side errors:

```ts
// instrumentation.ts
import { createPulseErrorReporter } from "@pulsekit/next";
import { createClient } from "@supabase/supabase-js";

export const onRequestError = createPulseErrorReporter({
  supabase: createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ),
});
```

The error reporter captures the error message, stack trace, HTTP method, route path, and route type. It will never throw — errors during reporting are silently caught so they don't break your app.

## Data Lifecycle

PulseKit uses a two-tier storage strategy: raw events for recent data and pre-computed aggregates for historical data.

### Refresh aggregates

The refresh-aggregates endpoint rolls up recent pageview events into daily aggregates in the `pulse_aggregates` table. The `<RefreshButton>` in the dashboard UI triggers this. Configure how far back to refresh with the `daysBack` option (default: 7).

### Consolidate and cleanup

The consolidate endpoint is designed for periodic cron jobs. It:

1. Rolls up pageview events older than `retentionDays` (default: 30) into `pulse_aggregates`
2. Deletes all raw events older than `retentionDays`

```ts
createConsolidateHandler({ supabase, retentionDays: 30 })
```

The dashboard automatically queries both raw events and aggregates seamlessly, so data remains continuous even after old events are deleted.

## Geolocation

PulseKit reads [Vercel's geolocation headers](https://vercel.com/docs/edge-network/headers#request-headers) (`x-vercel-ip-country`, `x-vercel-ip-city`, `x-vercel-ip-latitude`, `x-vercel-ip-longitude`, etc.) to capture visitor location data. This works automatically on all Vercel plans at no extra cost.

If you're not on Vercel, geolocation data will be empty unless your hosting provider populates these same headers (e.g., via a reverse proxy or CDN).

### Timezone detection

The `<PulseTracker>` sets a `pulse_tz` cookie with the visitor's browser timezone. Read it server-side with `getPulseTimezone()` and pass it to `<PulseDashboard>` so that the charts bucket data by the visitor's local date.

## Theming

PulseKit uses CSS custom properties for all visual styling. Import the stylesheet:

```tsx
import "@pulsekit/react/pulse.css";
```

### Automatic shadcn/ui integration

Several variables fall back to shadcn/ui CSS variables, so PulseKit automatically picks up your project's theme if you use shadcn/ui. No extra configuration needed.

### Custom properties reference

Override any of these on `:root` or a parent element to customize the dashboard appearance:

**Brand**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-brand` | `#7C3AED` | Primary brand color |
| `--pulse-brand-light` | `#8B5CF6` | Lighter brand variant (hover states) |

**Surfaces and text**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-bg` | `var(--card, #ffffff)` | Card/surface background |
| `--pulse-fg` | `var(--card-foreground, #111827)` | Primary text color |
| `--pulse-fg-muted` | `var(--muted-foreground, #6b7280)` | Secondary/muted text |
| `--pulse-border` | `var(--border, #e5e7eb)` | Border color |
| `--pulse-border-light` | `#f3f4f6` | Lighter border (table rows) |
| `--pulse-radius` | `var(--radius, 0.5rem)` | Border radius |

**Charts**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-chart-1` | `var(--chart-1, #7C3AED)` | Primary chart color (views) |
| `--pulse-chart-2` | `var(--chart-2, #06b6d4)` | Secondary chart color (unique visitors) |

**Map**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-map-land` | `#f0f0f0` | Land fill color |
| `--pulse-map-land-stroke` | `#d1d5db` | Land border color |
| `--pulse-map-marker` | `rgba(124, 58, 237, 0.55)` | Marker fill |
| `--pulse-map-marker-stroke` | `rgba(124, 58, 237, 0.85)` | Marker stroke |

**Web Vitals badges**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-vital-good-bg` | `#f0fdf4` | "Good" badge background |
| `--pulse-vital-good-fg` | `#15803d` | "Good" badge text |
| `--pulse-vital-warn-bg` | `#fefce8` | "Needs improvement" badge background |
| `--pulse-vital-warn-fg` | `#a16207` | "Needs improvement" badge text |
| `--pulse-vital-poor-bg` | `#fef2f2` | "Poor" badge background |
| `--pulse-vital-poor-fg` | `#dc2626` | "Poor" badge text |

**Other**

| Variable | Default | Description |
| --- | --- | --- |
| `--pulse-kpi-bg` | `#faf5ff` | KPI card background |
| `--pulse-btn-border` | `var(--border, #d1d5db)` | Button border |

### Example: dark theme override

```css
.dark {
  --pulse-bg: #1e1e2e;
  --pulse-fg: #cdd6f4;
  --pulse-fg-muted: #a6adc8;
  --pulse-border: #313244;
  --pulse-border-light: #45475a;
  --pulse-kpi-bg: #313244;
  --pulse-map-land: #313244;
  --pulse-map-land-stroke: #45475a;
}
```

## Configuration Reference

### `createPulseHandler({ supabase, config? })`

Creates the event ingestion API route handler.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `supabase` | `SupabaseClient` | — | Supabase client instance (required) |
| `config.allowedOrigins` | `string[]` | all origins | CORS origin whitelist. Supports exact match, `"*"`, and subdomain wildcards like `"*.example.com"` |
| `config.ignorePaths` | `string[]` | `[]` | Paths to silently ignore (returns 200 but doesn't store) |
| `config.siteId` | `string` | `"default"` | Default site ID for multi-tenant setups |
| `config.rateLimit` | `number` | `30` | Max requests per IP per window |
| `config.rateLimitWindow` | `number` | `60` | Rate limit window in seconds |
| `config.secret` | `string` | — | If set, requires a valid `x-pulse-token` header on requests |
| `config.onError` | `(error: unknown) => void` | — | Called on DB insert failure |

### `createPulseAuthHandler({ secret, cookieMaxAge? })`

Creates login/logout API route handler.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `secret` | `string` | — | Shared secret, minimum 16 characters (required) |
| `cookieMaxAge` | `number` | `604800` (7 days) | Auth cookie max-age in seconds |

Login is rate limited to 5 attempts per 60 seconds per IP.

### `withPulseAuth(handler)`

Wraps a Next.js route handler with auth protection. Accepts either a valid `pulse_auth` cookie or `Authorization: Bearer <secret>` header. Reads `PULSE_SECRET` from `process.env`.

### `createRefreshHandler({ supabase, daysBack? })`

Creates the aggregate refresh API route handler.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `supabase` | `SupabaseClient` | — | Supabase client with service role key (required) |
| `daysBack` | `number` | `7` | Number of days to refresh |

### `createConsolidateHandler({ supabase, retentionDays? })`

Creates the consolidation/cleanup API route handler.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `supabase` | `SupabaseClient` | — | Supabase client with service role key (required) |
| `retentionDays` | `number` | `30` | Events older than this are aggregated and deleted |

### `createPulseErrorReporter({ supabase, siteId? })`

Creates a Next.js `onRequestError` handler for server-side error tracking.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `supabase` | `SupabaseClient` | — | Supabase client (required) |
| `siteId` | `string` | `"default"` | Site ID for the error events |

### `<PulseTracker />`

Client component that tracks page views, Web Vitals, and errors.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `endpoint` | `string` | `"/api/pulse"` | API route URL |
| `excludePaths` | `string[]` | `[]` | Paths to skip tracking |
| `captureErrors` | `boolean` | `true` | Capture client-side JS errors |
| `errorLimit` | `number` | `10` | Max unique errors per page session |
| `token` | `string` | — | Signed ingestion token (from `createPulseIngestionToken`) |
| `onError` | `(error: unknown) => void` | — | Called on tracking request failure |

**What it tracks automatically:**
- Page views on route changes
- Web Vitals (LCP, INP, CLS, FCP, TTFB) via the `web-vitals` library
- Client-side errors (`window.onerror`, `unhandledrejection`)
- Browser timezone (stored in a `pulse_tz` cookie)

### `<PulseDashboard />`

React Server Component that renders the full analytics dashboard.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `supabase` | `SupabaseClient` | — | Supabase client with service role key (required) |
| `siteId` | `string` | — | Site ID to query (required) |
| `timeframe` | `Timeframe` | `"7d"` | `"7d"`, `"30d"`, or `{ from: string; to: string }` (ISO dates) |
| `timezone` | `string` | `"UTC"` | IANA timezone for date bucketing |
| `refreshEndpoint` | `string` | `"/api/pulse/refresh-aggregates"` | Endpoint for the refresh button |
| `onError` | `(error: unknown) => void` | — | Called on data query failure |

### `<PulseAuthGate />`

React Server Component that protects the dashboard with password auth.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | — | Dashboard content to protect (required) |
| `secret` | `string` | — | `PULSE_SECRET` value (required) |
| `authEndpoint` | `string` | `"/api/pulse/auth"` | Auth API endpoint |

## Environment Variables

| Variable | Required | Visibility | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only | Supabase service role key (for dashboard queries and admin routes) |
| `PULSE_SECRET` | Yes | Server-only | Shared secret for auth and ingestion tokens (minimum 16 characters) |

## Compatibility

| Dependency | Tested Versions |
| --- | --- |
| Node.js | 18, 20, 22 |
| Next.js | 14.x, 15.x |
| React | 18.x, 19.x |
| Supabase JS | 2.x |

## Development

This is a pnpm monorepo using Turborepo.

```bash
pnpm install     # Install all dependencies
pnpm build       # Build all packages
pnpm dev         # Watch mode
pnpm test        # Run all tests
pnpm lint        # Run ESLint
pnpm clean       # Remove dist/ from all packages
```

## License

MIT
