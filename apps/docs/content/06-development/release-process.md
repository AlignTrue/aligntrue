---
title: Release process
description: How to release AlignTrue packages with manual versioning and validation
---

# Release process

AlignTrue uses a manual release process with automated validation, workspace protocol safety checks, and post-publish verification.

## TL;DR

1. Preflight: clean git, npm auth, Node >=20 / pnpm >=9
2. Interactive (recommended): `pnpm release` or `pnpm release --type=patch|minor|major|current`
3. Scripted publish only: `pnpm release:helper patch|minor|major` (no git commit/tag; no dry-run)
4. Dry run: `pnpm release --dry-run`
5. After helper: run the printed git steps, then verify on npm

---

## Release workflow

### Prerequisites

Before releasing, confirm:

```bash
# Clean git status
git status

# Verify you're logged into npm
npm login

# Verify you're logged into git (SSH keys or git login)
git config --global user.email
git config --global user.name

# Optional quick checks (recommended before publish)
pnpm validate:workspace       # ensure no workspace:* leaks
pnpm test:fast                # or your preferred minimal test set
```

### 1. Interactive release (recommended)

```bash
pnpm release                  # interactive prompts
pnpm release --type=patch     # non-interactive, choose bump upfront
pnpm release --dry-run        # simulate, no changes
```

This prompts you for:

- **Bump type:** `patch` (fixes), `minor` (features), `major` (breaking), or `current` (no bump)
- **Confirmation:** Review version changes before proceeding
- **Dry run option:** Use `--dry-run` to simulate everything

What it does (real run):

- Bumps versions in publishable packages
- Builds all packages
- Publishes to npm via `pnpm publish` (rewrites `workspace:*`)
- Runs post-publish validation (`scripts/validate-published-deps.mjs`)
- Commits and tags git, then pushes (commit message: `chore: Release <version> (<bump>)`)

### 2. Scripted release (CI/automation)

```bash
# For patch release (0.1.0 -> 0.1.1)
pnpm release:helper patch

# For minor release (0.1.0 -> 0.2.0)
pnpm release:helper minor

# For major release (0.1.0 -> 1.0.0)
pnpm release:helper major
```

Notes:

- This path **publishes for real** (no dry-run flag available).
- It does **not** commit or tag. Follow the printed steps afterward.

### 3. What the script does

`pnpm release` (interactive) automatically:

1. Bumps versions in all `package.json` files
2. Builds all packages
3. Publishes to npm using `pnpm publish` (automatically rewrites `workspace:*` to concrete versions)
4. Post-validates: verifies npm registry has correct versions
5. Commits, tags, and pushes git

`pnpm release:helper` (scripted publish only):

1. Bumps versions in all `package.json` files
2. Builds all packages
3. Publishes to npm using `pnpm publish` (automatically rewrites `workspace:*`)
4. Post-validates via `scripts/validate-published-deps.mjs`
5. Prints manual git steps (no commit/tag is performed)

### 4. After publish

If you used `pnpm release:helper`, complete git steps manually:

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

Optional preflight check (fast):

```bash
pnpm validate:workspace    # or: node scripts/validate-workspace-protocol.mjs
```

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
pnpm release --dry-run
```

Dry run shows what would happen but makes no changes and performs no git operations.

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
