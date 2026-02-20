# Next.js + Supabase + PulseKit

A Next.js starter template with [Supabase](https://supabase.com) auth and [PulseKit](https://github.com/benoiteom/pulsekit) analytics pre-configured.

## What's included

- Next.js 15 (App Router) with Tailwind CSS and shadcn/ui
- Supabase Auth (password-based, with sign-up, login, password reset)
- PulseKit analytics: pageview tracking, web vitals, error reporting, and a built-in dashboard at `/admin/analytics`

## Getting started

### 1. Create a Supabase project

Create a new project at [database.new](https://database.new).

### 2. Clone and install

```bash
git clone <this-repo>
cd with-supabase-pulsekit
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/publishable key |
| `PULSE_SECRET` | A secret string used to sign analytics ingestion tokens and protect the dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (used for migrations only) |

You can find the Supabase values in your [project's API settings](https://supabase.com/dashboard/project/_?showConnect=true).

### 4. Run the database migration

Push the PulseKit analytics schema to your Supabase project:

```bash
npx supabase db push
```

This creates the `analytics` schema with the tables and RPC functions PulseKit needs.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## PulseKit integration

This template comes with PulseKit fully wired up:

- **Pageview tracking** — `PulseTracker` component in the root layout automatically tracks page views and web vitals
- **Error reporting** — `instrumentation.ts` reports server-side errors via `createPulseErrorReporter`
- **API routes** — `app/api/pulse/` handles event ingestion, auth, aggregate refresh, and consolidation
- **Analytics dashboard** — Visit `/admin/analytics` to view the dashboard (protected by `PULSE_SECRET`)

## Project structure

```
app/
  admin/analytics/page.tsx   # PulseKit dashboard
  api/pulse/                 # PulseKit API routes
  auth/                      # Supabase auth pages
  protected/                 # Authenticated pages
components/
  pulse-tracker-wrapper.tsx  # PulseTracker server component wrapper
  ui/                        # shadcn/ui components
lib/supabase/                # Supabase client helpers
instrumentation.ts           # Next.js instrumentation (error reporting)
supabase/migrations/         # SQL migration for PulseKit schema
```
