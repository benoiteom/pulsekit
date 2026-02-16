<p align="center">
  <img src="./assets/logo.svg" alt="PulseKit" width="200" />
</p>

<p align="center">
  Web analytics toolkit for Next.js + Supabase
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@pulsekit/core"><img src="https://img.shields.io/npm/v/@pulsekit/core.svg" alt="npm version" /></a>
  <a href="https://github.com/benoiteom/pulse-analytics/blob/main/LICENSE"><img src="https://img.shields.io/npm/@pulsekit/core.svg" alt="license" /></a>
  <a href="https://github.com/benoiteom/pulse-analytics/actions/workflows/ci.yml"><img src="https://github.com/benoiteom/pulse-analytics/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
</p>

---

PulseKit gives you a self-hosted analytics dashboard inside your Next.js app, backed by Supabase. Track page views, Web Vitals, errors, and visitor geography — no third-party scripts, no external services.

## Quick Start

Run the setup CLI in an existing Next.js project with Supabase:

```bash
npx create-pulsekit
```

This installs all packages, scaffolds the dashboard route, injects the tracker into your layout, and writes the Supabase migration.

After running, complete the setup:

1. Add your Supabase credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
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

### 1. Create the API route

```ts
// app/api/pulse/route.ts
import { createPulseHandler } from "@pulsekit/next";
import { createClient } from "@/lib/supabase/server";

const handler = createPulseHandler({ createClient });

export const POST = handler.POST;
```

### 2. Add the tracker to your layout

```tsx
// app/layout.tsx
import { PulseTracker } from "@pulsekit/next/client";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <PulseTracker />
      </body>
    </html>
  );
}
```

### 3. Add the dashboard page

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

### 4. Run the SQL migrations

Copy the migration files from `node_modules/@pulsekit/core/sql/` into your Supabase migrations directory and run `npx supabase db push`.

## Development

This is a pnpm monorepo using Turborepo.

```bash
pnpm install     # Install all dependencies
pnpm build       # Build all packages
pnpm dev         # Watch mode
pnpm clean       # Remove dist/ from all packages
```

## License

MIT
