<p align="center">
  <img src="https://raw.githubusercontent.com/benoiteom/pulsekit/main/assets/logo.svg" alt="PulseKit" width="200" />
</p>

# @pulsekit/react

React Server Components for the [PulseKit](https://github.com/benoiteom/pulsekit) analytics dashboard.

## Installation

```bash
npm install @pulsekit/react
```

**Peer dependencies:** `react >= 18.0.0`, `@supabase/supabase-js >= 2.0.0`

## Usage

Import the CSS and render the dashboard in a server component:

```tsx
// app/admin/analytics/page.tsx
import { PulseDashboard } from "@pulsekit/react";
import { createClient } from "@/lib/supabase/server";
import "@pulsekit/react/pulse.css";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  return <PulseDashboard supabase={supabase} />;
}
```

## Components

### Full Dashboard

- **`<PulseDashboard>`** — All-in-one analytics dashboard with charts, maps, vitals, and errors

### Individual Components

Use these to build a custom dashboard layout:

- **`<PulseChart>`** — Daily traffic line/bar chart
- **`<PulseMap>`** — Visitor geography world map
- **`<PulseVitals>`** — Web Vitals breakdown (LCP, FID, CLS, etc.)
- **`<PulseErrors>`** — Error tracking table
- **`<PulseAggregates>`** — Aggregated stats display
- **`<KpiRow>`** — Key metrics summary row

### Utility Components

- **`<RefreshButton>`** — Triggers a materialized view refresh
- **`<PulseIcon>`** — PulseKit logo icon
- **`<PulseDateRangePicker>`** — Date range selector for filtering data

## License

MIT
