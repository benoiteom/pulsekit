# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-03-31

### Added

- **@pulsekit/next**: `withPulseAuth` now accepts `CRON_SECRET` env var as a valid Bearer token, enabling Vercel Cron to authenticate automatically
- **create-pulsekit**: Scaffold `vercel.json` with cron entries for automatic aggregation (every 6 hours) and data cleanup (nightly at 3am UTC)
- **create-pulsekit**: Refresh and consolidate routes now export GET alongside POST for Vercel Cron compatibility
- **@pulsekit/core**: Add `pulse_referrer_aggregates` table — referrer stats are now archived during consolidation, so historical referrer data survives the raw-event retention window (`010_fix_aggregation.sql`)
- **@pulsekit/core**: Add `pulse_location_aggregates` table — location/map data is now archived during consolidation, so historical geo data survives the raw-event retention window (`011_location_aggregation.sql`)
- **@pulsekit/react**: Tabbed dashboard layout — `PulseDashboard` now renders five tabs (Traffic, Vitals, Errors, Events, System) instead of a single vertical page. The date picker is scoped to the Traffic tab; Vitals and Errors tabs use a 7d/30d toggle appropriate for their raw-data retention window.
- **@pulsekit/react**: New `PulseTabs` client component — URL-driven tab navigation (`?tab=`) with instant client-side switching
- **@pulsekit/react**: New `PulseTimeToggle` client component — 7d/30d range toggle for Vitals/Errors tabs (`?range=`)
- **@pulsekit/react**: New `tab` and `range` props on `PulseDashboard` — `tab` controls the active tab, `range` controls the Vitals/Errors timeframe independently from the Traffic date picker
- **@pulsekit/core**: New `pulse_events_list` and `pulse_events_count` SQL RPCs for paginated, filterable event browsing (`012_event_browser.sql`)
- **@pulsekit/core**: New `getPulseEvents` query function and `PulseEvent`/`EventsOverview` types for fetching raw events with filters
- **@pulsekit/react**: New `PulseEvents` client component — event browser with type/path/session filters, paginated table, and color-coded event type badges
- **@pulsekit/react**: `PulseDashboard` Events tab now shows the full event browser instead of a placeholder; new props `eventType`, `eventPath`, `eventSession`, `eventPage` for filter state
- **@pulsekit/core**: New `pulse_system_stats` SQL RPC for pipeline diagnostics — returns event counts by type, retention window, aggregation status, and session/path counts (`013_system_stats.sql`)
- **@pulsekit/core**: New `getPulseSystemStats` query function and `SystemStat`/`SystemOverview` types
- **@pulsekit/react**: New `PulseSystem` component — displays pipeline health, aggregation status, and configuration in the System tab
- **@pulsekit/react**: `PulseDashboard` System tab now shows live diagnostics instead of a placeholder

### Changed

- **@pulsekit/react**: `PulseDashboard` no longer fetches or renders `getPulseAggregates` — the consolidated data table will return as part of the System tab in a future release
- **@pulsekit/react**: Vitals and Errors data are now fetched using the `range` prop (7d/30d) instead of the Traffic `timeframe`, so they always query within the raw-event retention window

### Fixed

- **@pulsekit/core**: `pulse_refresh_aggregates` now uses `GREATEST()` on conflict instead of overwriting — previously a partial or repeated refresh could silently reduce an already-correct aggregate count (`010_fix_aggregation.sql`)
- **@pulsekit/core**: `pulse_consolidate_and_cleanup` now archives referrer data into `pulse_referrer_aggregates` before deleting old raw events
- **@pulsekit/core**: `pulse_referrer_stats` now unions raw events with `pulse_referrer_aggregates` for historical dates, matching the pattern of `pulse_stats_by_timezone`
- **@pulsekit/core**: `pulse_location_stats` now unions raw events with `pulse_location_aggregates` for historical dates — previously location/map data was permanently lost after the 30-day retention window
- **@pulsekit/core**: `pulse_consolidate_and_cleanup` now archives location data into `pulse_location_aggregates` before deleting old raw events
- **@pulsekit/react**: Remove 30-day minimum date restriction from `PulseDateRangePicker` so users can select date ranges that include consolidated (aggregated) data older than 30 days
- **create-pulsekit**, **examples**: Analytics page now reads `?from=` and `?to=` URL search params and passes them as the `timeframe` to `PulseDashboard` — previously the date picker updated the URL but the page always ignored it and queried with the hardcoded `"7d"` timeframe

## [1.1.1] - 2026-02-22

### Fixed

- **@pulsekit/core**: Add `SET search_path = analytics` to all `SECURITY DEFINER` SQL functions to prevent search-path hijacking (Supabase linter 0011)
- **@pulsekit/core**: Replace overly broad `GRANT ALL` to `anon` in `001_init_pulse.sql` with least-privilege grants — `anon` now only gets `INSERT` on `pulse_events`
- **@pulsekit/core**: Remove unnecessary `anon` SELECT policy on `pulse_aggregates` from initial setup

## [1.1.0] - 2026-02-22

### Added

- **@pulsekit/core**: Add `getPulseReferrers` query and `ReferrerStat`/`ReferrersOverview` types for traffic source analytics
- **@pulsekit/core**: Add `009_referrer_tracking.sql` migration — `referrer` column, partial index, and `pulse_referrer_stats` RPC function
- **@pulsekit/next**: Capture `document.referrer` hostname in `PulseTracker` pageview events
- **@pulsekit/next**: Accept and store `referrer` field in `createPulseHandler`
- **@pulsekit/react**: Add `PulseReferrers` component displaying top traffic sources table
- **@pulsekit/react**: Integrate traffic sources into `PulseDashboard` in a 2-column grid alongside Top Pages
- **create-pulsekit**: Include referrer tracking migration in scaffolded projects

**Upgrading from 1.0.x:** After updating packages, apply the new database migration:
```bash
cp node_modules/@pulsekit/core/sql/009_referrer_tracking.sql \
   supabase/migrations/20260223000000_referrer_tracking.sql
npx supabase db push
```

## [1.0.6] - 2026-02-22

### Changed

- **@pulsekit/react**: Replace `react-simple-maps` with `d3-geo` + `topojson-client` in `PulseMap` — fixes React 19 peer dependency warnings, removes dependency on unmaintained package, and reduces bundle size (~24 kB vs ~35 kB)

### Fixed

- **@pulsekit/next**: Decode URL-encoded `x-vercel-ip-city` header so city names with spaces (e.g. "San Francisco") are stored correctly instead of as "San%20Francisco"

## [1.0.5] - 2026-02-20

### Fixed

- **create-pulsekit**: Remove `lucide-react` and `cn` (`@/lib/utils`) dependencies from scaffolded spinner component — replaced with a self-contained inline SVG spinner using plain CSS keyframes, so it works in projects without shadcn/ui or Tailwind

## [1.0.4] - 2026-02-19

### Fixed

- **@pulsekit/react**: Add dark mode support — dashboard CSS custom properties now adapt to `.dark`, `[data-theme="dark"]`, and `prefers-color-scheme: dark` (KPI backgrounds, vital rating colors, map fills, border colors)
- **@pulsekit/react**: Fix chart tooltip text color using `--pulse-fg` so it's readable in dark mode

### Changed

- Replace `next-supabase-demo` example with `with-supabase-pulsekit` (standalone template using npm-published packages) and `with-supabase-pulsekit-local` (workspace-linked for local development)

## [1.0.3] - 2026-02-19

### Fixed

- **create-pulsekit**: Scaffold a `PulseTrackerWrapper` server component that generates an ingestion token via `createPulseIngestionToken` and passes it to `<PulseTracker />` — fixes 403s caused by the handler requiring `x-pulse-token` while the tracker was injected without a `token` prop
- **create-pulsekit**: Inject `<Suspense><PulseTrackerWrapper /></Suspense>` into the layout instead of bare `<PulseTracker />` — calls `await connection()` before `Date.now()` to fix Next.js 16 prerendering errors
- **README**: Fix `Request` → `NextRequest` type in ingestion route example
- **README**: Remove `req` argument from `createRefreshHandler` / `createConsolidateHandler` examples (both return zero-argument functions)
- **README**: Replace non-existent `typeof import("next").onRequestError` with `Parameters<ReturnType<typeof createPulseErrorReporter>>` in instrumentation example
- **README**: Replace layout example with Suspense-wrapped `PulseTrackerWrapper` pattern for Next.js 16 compatibility
- **README**: Add Next.js 16.x to compatibility table

## [1.0.2] - 2026-02-19

### Fixed

- **@pulsekit/react**: Revert CSS custom property wrappers back to `hsl(var(--border, ...))` format — the `var(--border, hsl(...))` approach from 1.0.1 breaks when shadcn/ui defines variables as raw HSL triplets (e.g. `--border: 0 0% 89.8%`)
- **create-pulsekit**: Wrap `<Suspense>` around `<PulseAuthGate>` in scaffolded analytics page to fix Next.js "uncached data outside Suspense" error
- **create-pulsekit**: Add `PULSE_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to post-install setup instructions
- **create-pulsekit**: Append PulseKit env var placeholders to `.env.example` when it exists
- **create-pulsekit**: Add middleware warning for projects with auth-protected routes (`/api/pulse`, `/admin/analytics`)

## [1.0.1] - 2026-02-18

### Fixed

- **@pulsekit/core**: Add `sql` to `files` in package.json
- **@pulsekit/react**: Replace Tailwind utility classes with plain CSS (`pulse-*` classes) so dashboard renders correctly in production without consumers needing to configure Tailwind purge for `node_modules/`
- **@pulsekit/react**: Fix CSS custom property wrappers (`hsl(var(--card, ...))` → `var(--card, hsl(...))`) for compatibility with Tailwind v4 / shadcn v2 oklch color values

### Removed

- **@pulsekit/react**: Remove `fix-extensions.mjs` post-build script; use explicit `.js` extensions in source imports instead, output `.js` (not `.mjs`) since package has `"type": "module"`

## [1.0.0] - 2026-02-18

### Added

- **@pulsekit/core**: v1.0.0 full baseline features release
- **@pulsekit/next**: v1.0.0 full baseline features release
- **@pulsekit/react**: v1.0.0 full baseline features release
- **create-pulsekit**: v1.0.0 full baseline features release
