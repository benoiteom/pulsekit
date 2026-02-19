<p align="center">
  <img src="https://raw.githubusercontent.com/benoiteom/pulsekit/main/assets/logo.svg" alt="PulseKit" width="200" />
</p>

# @pulsekit/next

Next.js integration for [PulseKit](https://github.com/benoiteom/pulsekit) — server-side API route handlers and a client-side tracker component.

## Installation

```bash
npm install @pulsekit/next
```

**Peer dependencies:** `next >= 14.0.0`, `react >= 18.0.0`, `@supabase/supabase-js >= 2.0.0`

## Server Exports

Import from `@pulsekit/next`:

### `createPulseHandler(config)`

Creates a `POST` handler for your analytics API route. Receives events from the client tracker and writes them to Supabase.

```ts
// app/api/pulse/route.ts
import { createPulseHandler } from "@pulsekit/next";
import { createClient } from "@/lib/supabase/server";

const handler = createPulseHandler({ createClient });

export const POST = handler.POST;
```

### `createRefreshHandler(config)`

Creates a handler for triggering materialized view refreshes (used by the dashboard refresh button).

```ts
// app/api/pulse/refresh/route.ts
import { createRefreshHandler } from "@pulsekit/next";
import { createClient } from "@/lib/supabase/server";

const handler = createRefreshHandler({ createClient });

export const POST = handler.POST;
```

### `createConsolidateHandler(config)`

Creates a handler for data consolidation/aggregation tasks.

### `createPulseErrorReporter(config)`

Creates an error reporter for capturing server-side errors and forwarding them to PulseKit.

### `getPulseTimezone()`

Reads the visitor's timezone from request headers.

## Client Exports

Import from `@pulsekit/next/client`:

### `<PulseTracker />`

Drop-in client component that automatically tracks page views and Web Vitals. Add it to your root layout:

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

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `endpoint` | `string` | `"/api/pulse"` | The API route that receives tracking events. |
| `excludePaths` | `string[]` | — | Paths where tracking is skipped (e.g. `["/admin"]`). |
| `captureErrors` | `boolean` | `true` | Capture `window.onerror` and unhandled rejections. |
| `errorLimit` | `number` | `10` | Max unique errors to report per page. |
| `token` | `string` | — | Signed ingestion token for authenticated event collection. |
| `onError` | `(error: unknown) => void` | — | Called when a tracking request fails. By default failures are silent so analytics never break your app. Pass this to surface issues during development or log them in production. |

## License

MIT
