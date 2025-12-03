---
title: Release process
description: How to release AlignTrue packages with manual versioning and validation
---

# Release process

AlignTrue uses a manual release process with automated validation, workspace protocol safety checks, and post-publish verification.

## TL;DR

1. Ensure all changes are committed and pushed to main
2. Run `pnpm release` (interactive) or `pnpm release:helper patch|minor|major` (scripted)
3. Script bumps versions, builds, publishes to npm, validates, and creates git tag
4. Verify on npm registry

---

## Release workflow

### Prerequisites

Before releasing:

```bash
# Ensure clean git status
git status

# Verify you're logged into npm
npm login

# Verify you're logged into git (SSH keys or git login)
git config --global user.email
git config --global user.name
```

### 1. Interactive release (recommended)

```bash
pnpm release
```

This prompts you for:

- **Bump type:** `patch` (fixes), `minor` (features), `major` (breaking), or `current` (no bump)
- **Confirmation:** Review version changes before proceeding
- **Dry run option:** Test with `--dry-run` flag

### 2. Scripted release (CI/automation)

```bash
# For patch release (0.1.0 -> 0.1.1)
pnpm release:helper patch

# For minor release (0.1.0 -> 0.2.0)
pnpm release:helper minor

# For major release (0.1.0 -> 1.0.0)
pnpm release:helper major
```

### 3. What the script does

The release script automatically:

1. Bumps versions in all `package.json` files
2. Builds all packages
3. Pre-validates: checks for workspace protocol leaks
4. Publishes to npm using `pnpm publish` (automatically rewrites `workspace:*` to concrete versions)
5. Post-validates: verifies npm registry has correct versions
6. Commits and tags git

### 4. After publish

The script prints next steps:

```bash
pnpm install
git add -A
git commit -m "chore: Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

---

## Workspace protocol safety

We use `workspace:*` protocol in `package.json` for internal dependencies during development. This ensures local development always uses the live code.

**Critical:** We never publish packages with `workspace:*` dependencies. Users cannot install them.

### Prevention strategy

Two-layer defense:

1. **pnpm Publish:** We use `pnpm publish` (not `npm publish`). pnpm automatically rewrites `workspace:*` to concrete versions during publish.
2. **Post-publish Validation:** `scripts/validate-published-deps.mjs` queries npm registry immediately after publishing. If it detects `workspace:*` leaks, it alerts you.

### Manual verification

To manually check a published package:

```bash
npm view aligntrue@latest dependencies
```

You should see concrete versions (e.g., `^0.2.2`), NOT `workspace:*`.

---

## Testing package installation locally

**Important:** `pnpm pack` creates tarballs with `workspace:*` dependencies intact.

### For local testing

**Method 1: Use absolute path to CLI binary (RECOMMENDED)**

```bash
cd /path/to/workspace
pnpm build  # Build all packages first

# Use absolute path
/path/to/workspace/packages/cli/dist/index.js --version
```

This is the most reliable method.

**Method 2: Use distribution simulation script**

```bash
cd packages/cli
bash tests/scripts/test-distribution.sh
```

This script simulates the real npm distribution by rewriting `workspace:*` to concrete versions.

### Why pnpm link --global doesn't work

`pnpm link --global` creates a symlink, but Node.js ESM loader cannot resolve `workspace:*` protocol through symlinks. Result: `ERR_PACKAGE_PATH_NOT_EXPORTED` errors.

---

## Dry run testing

Test the entire release process without publishing:

```bash
# Interactive dry run
pnpm release --dry-run

# Scripted dry run
pnpm release:helper patch  # Then check output
```

Dry run shows what would happen but makes no changes.

---

## Troubleshooting

### "Publish failed" or workspace leak detected

If post-publish validation fails:

1. Check if packages were actually published to npm
2. If yes, you may need to unpublish: `npm unpublish aligntrue@X.Y.Z`
3. Fix the workspace protocol issue
4. Try again

### Version mismatch

All packages must have the same version:

```bash
# Check versions
grep '"version"' packages/*/package.json

# If mismatched, fix manually or try releasing again
```

### Git push fails

If git operations fail after publishing:

1. Verify you have push access to the repository
2. Check your git SSH keys are configured
3. Manually complete git operations:
   ```bash
   pnpm install
   git add -A
   git commit -m "chore: Release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```

---

## Related

- [RELEASING.md](/RELEASING.md) - Detailed release strategy and workspace protocol documentation
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
