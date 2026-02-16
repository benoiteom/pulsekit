<p align="center">
  <img src="https://raw.githubusercontent.com/benoiteom/pulsekit/main/assets/logo.svg" alt="PulseKit" width="200" />
</p>

# create-pulsekit

CLI scaffolding tool for setting up [PulseKit](https://github.com/benoiteom/pulsekit) analytics in a Next.js project.

## Usage

Run in the root of an existing Next.js project:

```bash
npx create-pulsekit
```

## What It Does

1. **Detects** your package manager (npm, yarn, pnpm, bun)
2. **Validates** that you're in a Next.js project
3. **Installs** `@pulsekit/core`, `@pulsekit/next`, and `@pulsekit/react`
4. **Scaffolds** the analytics dashboard page and API routes
5. **Injects** the `<PulseTracker />` component into your root layout
6. **Injects** the error instrumentation for server-side error tracking
7. **Writes** the Supabase SQL migration file

## After Setup

1. Add your Supabase credentials to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
   ```
2. Link and push the database migration:
   ```bash
   npx supabase link
   npx supabase db push
   ```
3. Start your dev server and visit `/admin/analytics`

## License

MIT
