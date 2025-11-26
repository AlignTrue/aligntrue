# Releasing AlignTrue

## Prerequisites

- Clean git status
- Logged in to npm (`npm login`)
- Logged in to git (`git login` or SSH keys configured)

## Release Process

We use a helper script to automate version bumping, building, publishing, and git tagging.

### 1. Run Release Helper

```bash
# For patch release (0.1.0 -> 0.1.1)
pnpm release:helper patch

# For minor release (0.1.0 -> 0.2.0)
pnpm release:helper minor

# For major release (0.1.0 -> 1.0.0)
pnpm release:helper major
```

The script will:

1. Bump versions in all packages
2. Build all packages
3. **Pre-validate:** Check package.json for workspace leaks
4. **Publish:** Use `pnpm publish` to automatically rewrite `workspace:*` to concrete versions
5. **Post-validate:** Verify npm registry has correct versions

### 2. Commit and Tag

After successful publish, the script prints the next steps:

```bash
pnpm install
git add -A
git commit -m "chore: Release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

### 3. Update CHANGELOG

Ensure `CHANGELOG.md` is updated with the new version and date.

## Workspace Protocol Safety

We use `workspace:*` protocol in `package.json` for internal dependencies. This ensures local development always uses the live code in the monorepo.

**Crucial:** We must NEVER publish packages with `workspace:*` dependencies to npm. Users cannot install them.

### Prevention Strategy

We use a two-layer defense:

1. **pnpm Publish**: We strictly use `pnpm publish` (not `npm publish`). pnpm automatically rewrites `workspace:*` to the concrete version from `package.json` during the align process.
2. **Post-publish Validation**: `scripts/validate-published-deps.mjs` queries the npm registry immediately after publishing. If it detects `workspace:*` leaks, it alerts you to unpublish.

### Manual Verification

To manually check a published package:

```bash
npm view aligntrue@latest dependencies
```

You should see concrete versions (e.g., `^0.2.2`), NOT `workspace:*`.

## Testing Package Installation Locally

**IMPORTANT:** `pnpm pack` creates tarballs with `workspace:*` dependencies intact, which npm cannot resolve during global installation.

### For local testing

**Method 1: Use absolute path to CLI binary (RECOMMENDED)**

```bash
cd /path/to/workspace
pnpm build  # Build all packages first

# Use absolute path
/path/to/workspace/packages/cli/dist/index.js --version
```

This is the most reliable method and always works.

**Method 2: Use distribution simulation script**

```bash
cd packages/cli
bash tests/scripts/test-distribution.sh
```

This script simulates the real npm distribution experience by rewriting `workspace:*` to concrete versions.

### Why pnpm link --global doesn't work

`pnpm link --global` creates a symlink, but Node.js ESM loader cannot resolve `workspace:*` protocol through symlinks, even after building. This is a fundamental limitation:

1. The CLI `package.json` has `workspace:*` dependencies
2. Node.js follows the symlink to the workspace
3. When resolving subpath exports like `@aligntrue/core/config/edit-source-patterns`, Node.js looks at the `package.json` which has `workspace:*`
4. The ESM loader can't resolve `workspace:*` protocol references

**Result:** `ERR_PACKAGE_PATH_NOT_EXPORTED` errors for all subpath imports.

### For npm distribution

Always use `pnpm publish` which automatically rewrites `workspace:*` to concrete versions.

### Never use

- `pnpm link --global` for testing (will fail with ERR_PACKAGE_PATH_NOT_EXPORTED)
- `npm install -g <tarball>` from `pnpm pack` (will fail with workspace protocol errors)

Use absolute paths or the distribution simulation script instead.
