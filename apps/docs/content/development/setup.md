---
title: Development Setup
description: Prerequisites and installation instructions for AlignTrue development.
---

# Development setup

## Prerequisites

- **Node.js** 20 or later (`.node-version` file included for Volta/asdf/nvm)
- **pnpm** 9 or later

Install pnpm if you don't have it:

```bash
npm install -g pnpm@9
```

## Quick start

Bootstrap the entire project with one command:

```bash
pnpm bootstrap
```

This installs dependencies and builds all packages. You're ready to develop!

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

This will install dependencies for all workspace packages and set up Git hooks automatically.

### 2. Verify installation

After installation completes, verify everything works:

```bash
pnpm typecheck   # Type-check all packages
pnpm test:fast   # Run tests with fast reporter
```

If all checks pass, you're ready to develop!

## Git hooks

Hooks are installed automatically when you run `pnpm install`.

### Pre-commit hook

Runs automatically before each commit:

1. **Format staged files** (~1-2s) - Prettier auto-formats code
2. **Build packages** (~1-3s) - Only if `packages/*/src/**` files changed
3. **Typecheck** (~2-3s) - Type checks all staged TypeScript files

**Total time:**

- Without package changes: ~3-5 seconds
- With package changes: ~4-8 seconds

### Commit message hook

Validates commit messages follow Conventional Commits format:

```bash
# Good commit messages
feat: Add drift detection command
fix: Resolve lockfile sync issue
docs: Update setup guide

# Bad commit messages (will be rejected)
updated stuff
WIP
fixes bug
```

Format: `type: Subject in sentence case`

Valid types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`

### Pre-push hook

Runs automatically before pushing (takes ~30-60 seconds):

- Full typecheck across all packages
- Full test suite (all packages)
- Full build to catch build errors
- Mirrors CI validation

This ensures you never push code that will fail CI.

### Bypassing hooks (emergency only)

If hooks are genuinely broken (not just failing validation):

```bash
git commit --no-verify   # Skip pre-commit
git push --no-verify     # Skip pre-push
```

**Only use when hooks are broken, not to skip validation.**

### Hooks not running

If Git hooks aren't running after `pnpm install`:

```bash
pnpm prepare
```

This manually runs the Husky setup.

## Troubleshooting

### "Command not found: pnpm"

Install pnpm globally:

```bash
npm install -g pnpm@9
```

### "Module not found" errors

Reinstall dependencies:

```bash
pnpm clean
pnpm install
```

### Type errors after changes

Run type-check to see all errors:

```bash
pnpm typecheck
```

## Next steps

- Learn about the [workspace structure](/development/workspace)
- Explore [development commands](/development/commands)
- Understand [architectural concepts](/development/architecture)
