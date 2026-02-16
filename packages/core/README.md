<p align="center">
  <img src="https://raw.githubusercontent.com/benoiteom/pulsekit/main/assets/logo.svg" alt="PulseKit" width="200" />
</p>

# @pulsekit/core

Core analytics queries, types, and SQL migrations for [PulseKit](https://github.com/benoiteom/pulsekit).

## Installation

```bash
npm install @pulsekit/core
```

**Peer dependency:** `@supabase/supabase-js >= 2.0.0`

## What's Included

### Query Functions

Functions that fetch analytics data from Supabase via RPC:

- **`getPulseStats(supabase, options)`** — Page views, top pages, visitor locations, and daily traffic
- **`getPulseVitals(supabase, options)`** — Web Vitals metrics (LCP, FID, CLS, etc.)
- **`getPulseErrors(supabase, options)`** — Client and server error tracking data
- **`getPulseAggregates(supabase, options)`** — Pre-aggregated stats for KPI summaries
- **`dateRangeFromTimeframe(timeframe)`** — Convert a named timeframe (e.g. `"7d"`, `"30d"`) to a date range

### Types

Core TypeScript types used across all PulseKit packages:

```ts
import type {
  PulseEventType,
  PulseEventPayload,
  PulseStats,
  Timeframe,
  DailyStat,
  TopPageStat,
  LocationStat,
  WebVitalStat,
  VitalsOverview,
  ErrorStat,
  ErrorsOverview,
  AggregateRow,
  AggregatesOverview,
} from "@pulsekit/core";
```

### SQL Migrations

The `sql/` directory contains Supabase migration files that set up the required database schema:

| File | Purpose |
| --- | --- |
| `001_init_pulse.sql` | Base `pulse_events` table and RPC functions |
| `002_aggregation_function.sql` | Aggregation queries |
| `003_geo_and_timezone.sql` | Geolocation and timezone support |
| `004_web_vitals.sql` | Web Vitals storage and queries |
| `005_error_tracking.sql` | Error tracking tables and queries |
| `006_date_range_support.sql` | Date range filtering |
| `007_data_lifecycle.sql` | Data retention and cleanup |

Copy these into your Supabase migrations directory and run `npx supabase db push`.

## License

MIT
