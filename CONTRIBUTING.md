# Contributing to PulseKit

Thanks for your interest in contributing to PulseKit! This guide will help you get started.

## Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/pulsekit.git
   cd pulsekit
   ```

2. **Install dependencies** (requires [pnpm](https://pnpm.io/) v9+):
   ```bash
   pnpm install
   ```

3. **Build all packages**:
   ```bash
   pnpm build
   ```

4. **Start watch mode** for development:
   ```bash
   pnpm dev
   ```

## Monorepo Structure

```
packages/
  core/           → @pulsekit/core    (queries, types, SQL migrations)
  next/           → @pulsekit/next    (Next.js handlers + client tracker)
  react/          → @pulsekit/react   (dashboard components)
  create-pulsekit → create-pulsekit   (CLI scaffolding tool)
examples/
  next-supabase-demo/                 (working example app)
```

Packages depend on each other: `core` → `next` → `react`. Turborepo handles the build order automatically.

## Making Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. Make your changes. If you're modifying a package, run `pnpm build` to verify everything compiles.

3. If you're adding or changing SQL migrations, add a new file in `packages/core/sql/` following the existing naming convention (`NNN_description.sql`).

4. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add support for custom events"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/) loosely:
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `chore:` — maintenance, deps, tooling

5. Push your branch and open a pull request against `main`.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR.
- Include a clear description of what changed and why.
- If your change affects the public API of any package, note it in the PR description.
- Make sure `pnpm build` passes before submitting.

## Reporting Bugs

Open an issue using the **Bug Report** template. Include:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (Node version, OS, Next.js version)

## Suggesting Features

Open an issue using the **Feature Request** template. Describe the use case and why it would be useful.

## Code Style

- TypeScript strict mode is enabled — avoid `any` types.
- Follow the existing patterns in each package.
- Keep dependencies minimal — don't add a library for something that can be done in a few lines.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
