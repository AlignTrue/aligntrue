---
title: Development commands
description: Common commands for the AlignTrue ops platform.
---

# Development commands

## Core

- `pnpm build` — turbo build all packages/apps.
- `pnpm build:packages` — build only packages and platform modules.
- `pnpm typecheck` — full TypeScript check.
- `pnpm test` — full test suite.
- `pnpm test:fast` — fast reporter for quick feedback.

## App and packages

- `pnpm dev:app` — run the ops app.
- `pnpm dev:packages` — watch mode for packages.
- `pnpm start:app` — start app with preflight.

## Validation

- `pnpm validate:all` — workspace validators.
- `pnpm validate:transpile-packages` — ensure Next.js transpile config is correct.
- `pnpm validate:ui-tsconfig` — verify UI/TS configs.
- `pnpm validate:workspace` — enforce `workspace:*` protocol in package.json.

## Hygiene

- `pnpm lint` / `pnpm lint:fix`
- `pnpm format` / `pnpm format:check`
- `pnpm clean` — remove node_modules/dist/.next.
- `pnpm cleanup:temps` — delete cached test temp artifacts.
