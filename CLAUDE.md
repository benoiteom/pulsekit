# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PulseKit is a web analytics toolkit for Next.js + Supabase applications, organized as a pnpm monorepo with Turbo.

## Monorepo Structure

Four packages with a dependency chain: `@pulsekit/core` → `@pulsekit/next` → `@pulsekit/react`

- **`packages/core`** — Core analytics queries and types. Contains SQL migrations in `sql/` for Supabase schema setup (RPC functions, tables, web vitals).
- **`packages/next`** — Next.js integration. Server-side API route handlers (`createPulseHandler`, `createRefreshHandler`) and a client-side `PulseTracker` component. Has dual exports: main (server) and `/client` subpath.
- **`packages/react`** — React Server Components for analytics visualization (`PulseDashboard`, `PulseChart`, `PulseMap`, `PulseVitals`). Uses Recharts and react-simple-maps.
- **`packages/create-pulsekit`** — CLI scaffolding tool. Detects Next.js projects, installs packages, scaffolds files, injects code, and sets up DB migrations. Bundles SQL files from core during prebuild.

Example app in `examples/next-supabase-demo` (Next.js 15, Tailwind, shadcn/ui).

## Build Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (turbo, respects dependency order)
pnpm dev              # Watch mode for all packages
pnpm clean            # Remove dist/ from all packages
```

Each package uses `tsup` for building.

### Linting

ESLint v9 (flat config) is configured at the repo root (`eslint.config.mjs`) with `typescript-eslint`, `eslint-plugin-react-hooks`, and `@next/eslint-plugin-next`.

```bash
pnpm lint             # Run ESLint across all packages (turbo)
```

## Testing

Tests use **vitest** (root dev dependency). Configuration is in `vitest.config.ts` at the repo root, which globs `packages/*/src/__tests__/**/*.test.ts`.

```bash
pnpm test             # Run all tests (vitest run)
```

Test files:
- `packages/core/src/__tests__/dateRange.test.ts` — `dateRangeFromTimeframe` pure function
- `packages/core/src/__tests__/queries.test.ts` — `getPulseStats`, `getPulseVitals`, `getPulseErrors` data transforms and `rateVital` threshold logic
- `packages/next/src/__tests__/handler.test.ts` — `createPulseHandler` validation, origin checking, rate limiting, DB insert
- `packages/create-pulsekit/src/__tests__/detect.test.ts` — `detectPackageManager`, `validateNextJsProject`, `getAppDir`
- `packages/create-pulsekit/src/__tests__/inject.test.ts` — `injectPulseTracker`, `injectInstrumentation` code injection

Mocking patterns: Supabase is mocked as a chainable object (`schema → from/rpc → insert`). `node:fs` is mocked via `vi.mock` factory for CLI tests. `next/server` is mocked for handler tests.

## Key Architecture Details

- All packages output ESM except `create-pulsekit` (CJS, targets Node 18)
- Analytics data flows: client tracking → Next.js API routes → Supabase RPC functions → React Server Components for display
- `create-pulsekit` has a prebuild step that copies `packages/core/sql/*.sql` into `src/sql/` before bundling them as JSON assets
- `@pulsekit/next` uses `"use client"` banner on its client entry point via tsup config
- `@pulsekit/react` builds with `bundle: false` (unbundled output)
- Supabase is a peer dependency — not bundled with any package

## Running Migrations (Example App)

The example app (`examples/next-supabase-demo`) is linked to a remote Supabase project via the Supabase CLI. To push a new SQL migration:

1. Create a migration file in `examples/next-supabase-demo/supabase/migrations/` following the naming convention `YYYYMMDD000000_description.sql` (next sequential date after existing migrations).
2. Run from the example app directory:
   ```bash
   cd examples/next-supabase-demo && npx supabase db push
   ```

The Supabase CLI is not installed globally — use `npx supabase`. The project ref is stored in `supabase/.temp/project-ref`.

## Publishing to npm

Packages are published manually (no changesets or release tooling). Ensure you're logged in (`npm login`) and that packages are built before publishing.

```bash
pnpm build                          # Build all packages first
pnpm -r publish --access public     # Publish all packages recursively
```

The `--access public` flag is required for `@pulsekit/*` scoped packages. Bump versions in each `package.json` before publishing a new release.

## Changelog

When making a change worth noting (bug fix, new feature, breaking change, performance improvement), add an entry to `CHANGELOG.md` under the `## Unreleased` section. Use Keep a Changelog format with categories: Added, Changed, Fixed, Removed. Update the version number in the corresponding package.json accordingly.
