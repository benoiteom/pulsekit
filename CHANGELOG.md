# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
