# Release Process

AlignTrue uses [Changesets](https://github.com/changesets/changesets) for version management and automated npm publishing.

## TL;DR

1. Make changes, push to main
2. Run `pnpm changeset` to document changes
3. Changesets bot creates "Version Packages" PR automatically
4. Merge that PR → packages publish to npm automatically

---

## Day-to-day workflow

### 1. Making changes

Work normally:

```bash
# Make your changes
git add .
git commit -m "feat: add new feature"
git push origin main
```

### 2. Creating a changeset

For each feature/fix that should be in the changelog:

```bash
pnpm changeset
```

This prompts you for:

- **Which packages changed?** (select with space, usually all `@aligntrue/*`)
- **Bump type?** Choose:
  - `patch` - Bug fixes (0.1.0-alpha.2 → 0.1.0-alpha.3)
  - `minor` - New features (0.1.0 → 0.2.0)
  - `major` - Breaking changes (0.1.0 → 1.0.0)
- **Summary** - Brief description for CHANGELOG

This creates a file in `.changeset/` that you commit:

```bash
git add .changeset/
git commit -m "chore: add changeset"
git push
```

### 3. Automatic "Version Packages" PR

The Changesets GitHub Action automatically:

- Creates/updates a PR titled "Version Packages"
- Bumps versions in all `package.json` files
- Updates `CHANGELOG.md`
- Keeps this PR up-to-date as you add more changesets

### 4. Release

When ready to publish:

1. **Review the "Version Packages" PR**
   - Check version bumps are correct
   - Review CHANGELOG entries
   - Verify all packages build

2. **Merge the PR**
   - GitHub Actions automatically publishes to npm
   - Creates a GitHub release
   - Tags the commit

---

## Alpha releases

For pre-1.0 alpha releases:

```bash
# Enter pre-release mode (one time)
pnpm changeset pre enter alpha

# Create changesets as normal
pnpm changeset

# Exit pre-release mode when ready for stable
pnpm changeset pre exit
```

**Current status:** We're in alpha mode, so versions are `0.1.0-alpha.X`.

---

## Manual release (emergency only)

If you need to publish manually:

```bash
# Bump versions
pnpm changeset version

# Build and publish
pnpm release
```

**Note:** This bypasses CI checks. Only use for emergencies.

---

## Setup (one-time)

### 1. Add NPM_TOKEN to GitHub Secrets

1. Generate npm token: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Type: **Automation**
   - Scope: **Read and write**
2. Add to GitHub: Settings → Secrets → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: `npm_xxxxxxxxxxxx`

### 2. Verify Changesets config

Already configured in `.changeset/config.json`:

```json
{
  "linked": [["@aligntrue/*"]], // All packages version together
  "access": "public", // Public npm packages
  "baseBranch": "main"
}
```

---

## Troubleshooting

### "Version Packages" PR not created

- Check GitHub Actions tab for errors
- Verify `NPM_TOKEN` secret is set
- Ensure you've created at least one changeset

### Publish failed

- Check npm token hasn't expired
- Verify package names are available on npm
- Check CI logs in GitHub Actions

### Wrong version bump

Before merging "Version Packages" PR:

1. Delete the changeset file that caused it: `.changeset/some-name.md`
2. Create a new changeset with correct bump type
3. PR will auto-update

---

## Related

- [Changesets documentation](https://github.com/changesets/changesets)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
