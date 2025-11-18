---
title: Commands
description: Development commands, testing, and build workflows for AlignTrue.
---

# Development commands

Common commands and workflows for AlignTrue development.

## Core commands

### Run docs locally

```bash
pnpm dev
```

Starts the documentation site at `http://localhost:3000` (from `apps/docs`)

### Build all packages

```bash
pnpm build
```

### Run tests

```bash
pnpm test        # All tests across all packages
pnpm test:fast   # Fast reporter for quick feedback
```

### Type-check all packages

```bash
pnpm typecheck
```

### Format

```bash
pnpm format        # Format code with Prettier
pnpm format:check  # Check formatting without changes
```

### Validation workflow

Run before large refactors to ensure clean baseline:

```bash
pnpm pre-refactor  # Type check + lint entire workspace
```

### Clean

```bash
# Remove all node_modules and build artifacts
pnpm clean

# Remove temp files created by AI/debugging
pnpm clean-temp
```

## Working on packages

### Package build workflow

When editing workspace packages that other packages depend on (core, schema, exporters), you have two options:

**Option 1: Watch mode (recommended for active development)**

Run packages in watch mode for automatic rebuilds on save:

```bash
pnpm dev:packages
```

This runs all packages in parallel watch mode. Keep this running in a separate terminal while developing.

**Option 2: Manual builds**

Build packages explicitly when needed:

```bash
# Build all packages
pnpm build:packages

# Build specific package
pnpm --filter @aligntrue/core build
```

### Why builds matter

Packages import from `dist/` directories of their dependencies (e.g., CLI imports from `packages/core/dist/`). If you edit source in `packages/core/src/` but don't rebuild, other packages will see stale types and code.

**The pre-commit hook automatically rebuilds packages when source files change**, so you won't commit stale builds. But during development, use watch mode for instant feedback.

### Working with type changes

When you change exported types in core packages (schema, core, exporters, plugin-contracts):

1. Build the package: `pnpm --filter @aligntrue/schema build`
2. Turbo automatically rebuilds dependent packages

Or just run `pnpm build:packages` to rebuild everything. Turbo's dependency graph ensures packages build in the correct order.

### Workspace protocol and release checks

- All `@aligntrue/*` dependencies must use `workspace:*` so local builds always take priority. Run `pnpm validate:workspace` if you edit `package.json`.
- After `pnpm install`, run `pnpm verify:workspace-links` when diagnosing type mismatches. It ensures node_modules links resolve to local workspace packages.
- Before publishing, run `pnpm prepublish:check`. It verifies versions match across packages, the git tree is clean, and build/typecheck/test succeed.
- CI runs the same checks in `.github/workflows/ci.yml`, so keeping them green locally prevents “works on my machine” releases.

## Running tests locally

### All tests

Run the full test suite across all packages:

```bash
pnpm test
```

### Specific package

Test a single package:

```bash
pnpm --filter @aligntrue/cli test
pnpm --filter @aligntrue/schema test
pnpm --filter @aligntrue/core test
```

### Specific test file

Run a specific test file:

```bash
pnpm --filter @aligntrue/cli vitest run tests/commands/sync.test.ts
```

### Watch mode

Run tests in watch mode for rapid feedback during development:

```bash
# Watch all tests in a package
pnpm --filter @aligntrue/cli vitest

# Watch specific test file
pnpm --filter @aligntrue/cli vitest tests/commands/sync.test.ts

# Watch with UI
pnpm --filter @aligntrue/cli vitest --ui
```

### With coverage

Generate coverage reports:

```bash
pnpm --filter @aligntrue/cli vitest --coverage
```

### Deterministic test environment

Match CI environment exactly (useful for debugging CI failures):

```bash
TZ=UTC pnpm test
```

### Fast feedback mode

Use the fast reporter for quicker output:

```bash
pnpm test:fast
```

## Design system and theming

AlignTrue uses a centralized design system (`@aligntrue/ui`) for consistent branding across all web properties.

### Key components

- **AlignTrueLogo** - SVG logo with theme-aware colors and orange colon (#F5A623)
- **Primer-based colors** - Semantic tokens that adapt to light/dark modes

### Using the design system

Import components and styles in your Next.js app:

```tsx
import { AlignTrueLogo } from "@aligntrue/ui";
import "@aligntrue/ui/styles/tokens.css";
```

### Color tokens

Use semantic color tokens instead of hardcoded colors:

```tsx
// Good - adapts to theme
<div style={{ color: "var(--fgColor-default)" }}>Text</div>

// Bad - hardcoded, breaks in dark mode
<div style={{ color: "#171717" }}>Text</div>
```

Available token categories:

- `--fgColor-*` - Foreground/text colors
- `--bgColor-*` - Background colors
- `--borderColor-*` - Border colors
- `--color-neutral-*` - Neutral scale (50-950)

See [workspace structure](/docs/08-development/workspace) for complete documentation.

### Testing themes

Test both light and dark modes during development:

1. Use the theme toggle in the UI
2. Check browser DevTools → Application → Local Storage for `aligntrue-theme`
3. Toggle system preference in OS settings to test "system" mode
4. Verify no FOUC (flash of unstyled content) on page load

### Nextra documentation sites

For Nextra-based docs, import Nextra's base styles and configure your `apps/docs/theme.config.tsx` directly:

```tsx
import "nextra-theme-docs/style.css";
import type { DocsThemeConfig } from "nextra-theme-docs";
import { AlignTrueLogo } from "@aligntrue/ui";

const themeConfig: DocsThemeConfig = {
  logo: <AlignTrueLogo size="md" />,
  docsRepositoryBase: "https://github.com/org/repo/tree/main/apps/docs",
  navigation: true,
};

export default themeConfig;
```

This provides:

- Branded logo via the shared `AlignTrueLogo` component
- Consistent sidebar and TOC configuration
- Nextra's built-in theme system for colors

## Code quality

### TypeScript

- All packages use strict TypeScript
- Extends `tsconfig.base.json` from repo root
- No `any` types allowed
- Use `unknown` and narrow types

### Formatting

EditorConfig is configured at the root. Use:

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding

### Testing

- Unit tests go in `packages/*/tests/`
- Keep tests fast (<1s per test)
- Make tests deterministic (no real time, network, or randomness)

## Common tasks

### Add a new package

1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Create `tsconfig.json` extending base
4. Add to workspace commands in root `package.json`

### Update dependencies

```bash
pnpm update --latest --recursive
```

### Check for security issues

```bash
pnpm audit
```

## Versioning with Changesets

We use Changesets for managing package versions and changelogs.

### Creating a changeset

After making changes, create a changeset describing your changes:

```bash
pnpm changeset
```

Follow the prompts to:

1. Select which packages changed
2. Choose version bump type (major/minor/patch)
3. Write a summary of changes

The changeset file will be committed with your changes.

### Versioning packages

To consume changesets and bump versions:

```bash
pnpm version
```

This updates `package.json` versions and `CHANGELOG.md` files.

### Publishing packages

After versioning, publish to npm:

```bash
pnpm release
```

This builds all packages and publishes them to npm.

## CI/CD

CI runs on every PR:

- Lockfile sync validation
- `pnpm typecheck` - Type checking
- `pnpm test` - Tests
- `pnpm build` - Production build
- Integration tests
- Golden repository validation

All must pass before merge.

**Note:** Pre-push hooks mirror CI checks, so if pre-push passes, CI should pass too.

## Troubleshooting

### Pre-commit hook fails with formatting errors

The hook auto-formats code with Prettier. If it still fails, check the error output for issues with the lockfile update or other problems.

### Pre-push hook is too slow

Pre-push runs the full validation suite (~30-60 seconds). This is intentional to catch issues before CI.

For faster iteration during development, use watch mode for tests instead of relying on hooks.

### Commit message rejected

Ensure your commit message follows Conventional Commits format:

```bash
<type>: <description>
```

Example: `feat: Add new command` or `fix: Resolve memory leak`

## Next steps

- Review [workspace structure](/docs/08-development/workspace)
- Understand [architecture concepts](/docs/08-development/architecture)
- See [setup guide](/docs/08-development/setup) for installation
