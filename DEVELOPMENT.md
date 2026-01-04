<!--
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY

  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files

  Source: apps/docs/content/development/*.md
-->

# Development Guide

> This guide is auto-generated from the AlignTrue documentation site.

## Table of Contents

- [Development commands](#development-commands)
- [Development setup](#development-setup)

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

---

# Development setup

## Prerequisites

- Node.js 20+ (repo pins 20.18.1 via `.node-version`)
- pnpm 10 (`packageManager` is `pnpm@10.27.0`)

## Install and build

```bash
pnpm install
pnpm build        # turbo build across packages
```

## Fast loop

```bash
pnpm dev:app      # run the app
pnpm dev:packages # watch builds for packages
pnpm test:fast    # quick tests
```

## Full checks (CI parity)

```bash
pnpm ci           # pre-ci + validate + lint + typecheck + full tests
```

## Tips

- Keep `pnpm dev:packages` running when editing packages consumed by the app.
- Use `pnpm validate:workspace` after editing `package.json` dependencies.
- Prefer `pnpm clean && pnpm install` if workspace links look stale.

---

_This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in `apps/docs/content/` and run `pnpm generate:repo-files`._
