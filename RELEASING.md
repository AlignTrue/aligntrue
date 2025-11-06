# Quick Release Guide

## Setup (one time only)

1. **Add NPM_TOKEN to GitHub Secrets:**
   - Go to: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Create new token: **Automation** type with **Read and write** scope
   - Add to GitHub: Settings → Secrets → Actions → New repository secret
     - Name: `NPM_TOKEN`
     - Value: your token

2. **Enter alpha pre-release mode** (since we're at 0.1.0-alpha.X):
   ```bash
   pnpm changeset pre enter alpha
   git add .changeset/pre.json
   git commit -m "chore: enter alpha pre-release mode"
   git push
   ```

---

## Daily workflow

### When you make changes:

```bash
# 1. Make your changes and commit normally
git add .
git commit -m "feat: add cool feature"

# 2. Create a changeset
pnpm changeset
# Select packages (usually all @aligntrue/*)
# Choose bump: patch for fixes, minor for features, major for breaking
# Write summary for CHANGELOG

# 3. Commit and push
git add .changeset/
git commit -m "chore: add changeset"
git push
```

### When ready to release:

1. **Changesets bot automatically creates "Version Packages" PR**
2. **Review the PR** (check versions and CHANGELOG)
3. **Merge it** → packages publish to npm automatically ✨

---

## Commands

| Command                          | What it does                                        |
| -------------------------------- | --------------------------------------------------- |
| `pnpm changeset`                 | Create a changeset (do this after each feature/fix) |
| `pnpm changeset status`          | See pending changesets                              |
| `pnpm changeset pre enter alpha` | Enter alpha pre-release mode                        |
| `pnpm changeset pre exit`        | Exit pre-release mode (for stable 1.0)              |

---

## Troubleshooting

**"Version Packages" PR not appearing?**

- Check you've created at least one changeset
- Check GitHub Actions tab for errors
- Verify NPM_TOKEN secret is set

**Need to release NOW?**

```bash
pnpm changeset version  # Bump versions
pnpm release            # Build and publish
```

---

See [docs/development/release-process.md](docs/development/release-process.md) for full details.
