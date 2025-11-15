# Release Guide

AlignTrue uses a simple manual release process. No bots, no automation, full control.

---

## Setup (one time only)

### 1. Login to npm

```bash
npm login
```

Enter your npm credentials. This creates a token in `~/.npmrc`.

### 2. Verify access

```bash
npm whoami
# Should show your npm username

npm org ls aligntrue
# Should show you have publish access
```

---

## Release Process

### When ready to release:

```bash
# Interactive mode (recommended)
pnpm release

# Non-interactive mode
pnpm release --type=alpha    # For alpha releases
pnpm release --type=patch    # For bug fixes (0.x.y -> 0.x.y+1)
pnpm release --type=minor    # For features (0.x.y -> 0.x+1.0)
pnpm release --type=major    # For breaking changes (0.x.y -> x+1.0.0)
```

### What the script does:

1. **Detects all workspace packages** - Finds all publishable packages
2. **Prompts for version type** - Interactive selection with version preview
3. **Bumps versions** - Updates all package.json files
4. **Builds packages** - Runs `pnpm build:packages`
5. **Publishes to npm** - Publishes with correct tag (`alpha` or `latest`)
6. **Creates git commit and tag** - Commits version changes and tags release
7. **Pushes to GitHub** - Pushes commit and tags

---

## Version Scheme

AlignTrue uses semantic versioning with alpha pre-releases:

| Type  | Example Bump           | Use For                            |
| ----- | ---------------------- | ---------------------------------- |
| alpha | `1.0.0-alpha.5` → `.6` | Pre-release testing                |
| patch | `1.0.0` → `1.0.1`      | Bug fixes, no new features         |
| minor | `1.0.0` → `1.1.0`      | New features, backwards compatible |
| major | `1.0.0` → `2.0.0`      | Breaking changes                   |

### Current status:

- **Now:** `1.0.0-alpha.x` (pre-release testing)
- **Soon:** `1.0.0` (stable release)

After exiting alpha, use `patch`, `minor`, or `major` for all releases.

---

## Updating CHANGELOG.md

After a release, update `CHANGELOG.md`:

1. Add a new `## [X.Y.Z] - YYYY-MM-DD` section at the top
2. Group changes under:
   - **Added** - New features
   - **Changed** - Changes to existing functionality
   - **Deprecated** - Soon-to-be removed features
   - **Removed** - Removed features
   - **Fixed** - Bug fixes
   - **Security** - Security fixes

AI typically updates the CHANGELOG when adding features, but you can ask it to add release notes after running `pnpm release`.

---

## Dry Run (Test Before Release)

```bash
pnpm release --dry-run
```

This shows what would happen without actually:

- Modifying files
- Publishing to npm
- Creating git commits/tags

Use this to verify version bumps look correct.

---

## Troubleshooting

### "EAUTH" or "403 Forbidden"

```bash
npm logout
npm login
```

Re-authenticate with npm.

### "Working directory not clean"

Commit or stash changes before releasing:

```bash
git status
git stash  # or git commit
```

### Need to unpublish a broken release?

```bash
npm unpublish aligntrue@1.0.0-alpha.X
npm unpublish @aligntrue/cli@1.0.0-alpha.X
# ... repeat for all packages
```

⚠️ **Warning:** You cannot republish the same version after unpublishing. Bump to the next version instead.

---

## Manual Emergency Release

If the script fails partway through:

```bash
# 1. Manually bump versions in package.json files
# 2. Build
pnpm build:packages

# 3. Publish each package
cd packages/schema && npm publish --tag alpha
cd packages/core && npm publish --tag alpha
cd packages/exporters && npm publish --tag alpha
cd packages/sources && npm publish --tag alpha
cd packages/file-utils && npm publish --tag alpha
cd packages/plugin-contracts && npm publish --tag alpha
cd packages/testkit && npm publish --tag alpha
cd packages/cli && npm publish --tag alpha
cd packages/aligntrue && npm publish --tag alpha

# 4. Commit and tag
git add .
git commit -m "chore: Release X.Y.Z (manual)"
git tag vX.Y.Z
git push && git push --tags
```

---

## Post-Release Checklist

After a successful release:

1. ✅ Verify on npm: https://www.npmjs.com/package/aligntrue
2. ✅ Test installation: `npx aligntrue@alpha --version`
3. ✅ Update CHANGELOG.md
4. ✅ Announce in Discord/Twitter (if significant)
5. ✅ Update docs site if behavior changed
