---
title: Development setup
description: Setup instructions for the AlignTrue ops platform.
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
