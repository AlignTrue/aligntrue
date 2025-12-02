---
title: CI troubleshooting
description: Fix common AlignTrue CI failures with deterministic checks
---

CI now runs a series of fail-fast checks. When one of them fails, look for the matching error message below.

## Workspace protocol validation failed

**Symptom**

```
Workspace protocol validation failed: @aligntrue/core version is "^0.2.0".
```

**Fix**

1. Run `pnpm validate:workspace` locally.
2. Update the dependency to `workspace:*` in the referenced `package.json`.
3. Re-run `pnpm install && pnpm build:packages`.

## Workspace link verification failed

**Symptom**

```
Workspace link verification failed: @aligntrue/cli → /node_modules/.pnpm/...
```

**Fix**

1. Ensure you ran `pnpm install` after switching branches.
2. If links still resolve to `.pnpm`, run `pnpm clean && pnpm install`.
3. Re-run `pnpm verify:workspace-links`.

## Version mismatch during prepublish

**Symptom**

```
Versions must match across all workspace packages.
```

**Fix**

1. Run `pnpm prepublish:check` locally; it prints every mismatched package.
2. Bump all packages to the same version (for example, 0.2.0) before releasing.

## Type mismatch after renaming formats

**Symptom**

```
TS2322: Type '"agents-md"' is not assignable to type '"agents"'.
```

**Fix**

1. Ensure packages were rebuilt: `pnpm build:packages`.
2. Run `pnpm validate:workspace` and `pnpm verify:workspace-links`.
3. If CI still fails, run `pnpm clean && pnpm install` to refresh workspace links.
