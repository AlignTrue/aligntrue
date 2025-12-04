# Git workflows guide

Ad-hoc rule discovery and team sharing with git sources.

## Overview

AlignTrue supports intelligent git source management with automatic update checking:

- **Smart caching** - Checks for updates on a TTL (default 24 hours), commits never
- **Solo mode** - Auto-updates on sync (stay current automatically)
- **Team mode** - Approval required for updates (controlled governance)
- **Offline support** - Works without network, falls back to cache

## Automatic updates

Git sources automatically check for updates based on ref type:

### Branch references (auto-update)

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main # Checks for updates based on TTL (default 24 hours)
```

**Solo mode**: Automatically pulls updates on `aligntrue sync`  
**Team mode**: Source changes documented in lockfile; approval via git PR

### Tag references (stable)

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    ref: v1.2.0 # Checks for updates based on same TTL (default 24 hours)
```

Tags use the same check interval as branches to detect force-pushes.

### Commit SHAs (pinned)

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    ref: abc1234def # Never checks (immutable)
```

Commit SHAs are immutable and never check for updates.

## Configuration

### Global defaults

```yaml
git:
  offline_fallback: true # Use cache if network fails (default: true)
```

### Per-source override

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main
    check_interval: 3600 # Check hourly instead of daily
```

### Command flags

```bash
# Force check now (bypass TTL)
aligntrue sync --force-refresh

# Skip all checks, use cache only
aligntrue sync --skip-update-check

# Offline mode (no network)
aligntrue sync --offline
```

## Using git sources

To use rules from git repositories, add them to your config file:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: main
```

**What happens:**

1. Repository cloned to `.aligntrue/.cache/git/` on first sync
2. Rules extracted from directory scan (default: `.` scans for `.md`/`.mdc` files)
3. Rules merged with your local rules
4. Future syncs automatically check for updates based on ref type

**Ref types:**

- **Branches** (`ref: main`) - Auto-updates based on TTL (default 24 hours)
- **Tags** (`ref: v1.2.0`) - Stable, checks based on same TTL (default 24 hours)
- **Commits** (`ref: abc1234`) - Pinned, never checks for updates

See [Git Sources Reference](/docs/04-reference/git-sources) for complete documentation.

## Privacy and consent

First git operation triggers consent prompt:

```
Git clone requires network access. Grant consent? (y/n)
```

**Consent is persistent:**

- Granted once per machine
- Stored in `.aligntrue/privacy-consent.json` (git-ignored)
- Applies to all future git operations

**Manage consent:**

```bash
# View consent status
aligntrue privacy audit

# Revoke consent
aligntrue privacy revoke git

# Grant consent non-interactively
aligntrue privacy grant git
```

## Local source directories

If you want to use rules from a local directory (e.g., a git submodule or monorepo path), use `type: local` sources:

```yaml
sources:
  - type: local
    path: vendor/shared-rules
```

This works well with git submodules or subtrees if you want to manage external rules as part of your repository. AlignTrue will read rules from the local path on each sync.

**Example with git submodule:**

```bash
# Add submodule
git submodule add https://github.com/org/rules vendor/shared-rules

# Add to AlignTrue config
# .aligntrue/config.yaml
sources:
  - type: local
    path: vendor/shared-rules

# Sync to use the rules
aligntrue sync
```

## Troubleshooting

### Network errors

**Symptom:** `Failed to clone repository`

**Causes:**

- No internet connection
- Repository doesn't exist
- Private repo without auth

**Solutions:**

```bash
# Check URL
curl -I https://github.com/yourorg/rules

# Use SSH for private repos in config
# sources:
#   - type: git
#     url: git@github.com:yourorg/private-rules.git
```

### Authentication failures

**Symptom:** `Authentication failed` for private repositories

**Solution:** Configure git credentials:

```bash
# HTTPS with token
git config --global credential.helper store
# Then clone once with token to cache

# SSH keys (recommended)
ssh-add ~/.ssh/id_rsa
```

### Missing rules file

**Symptom:** No markdown rules found in repository

**Cause:** Repository doesn't have `.md` or `.mdc` files at the specified path

**Solution:** Specify custom path in config:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    path: rules/typescript.yaml # Custom path
```

### Cache corruption

**Symptom:** Cached repository exists but rules can't be read

**Solution:** Clear cache and re-sync:

```bash
# Remove corrupted cache
rm -rf .aligntrue/.cache/git

# Re-sync to fetch fresh copy
aligntrue sync
```

### Consent denied

**Symptom:** `Network operation requires consent`

**Solution:** Grant consent:

```bash
# Interactive grant
aligntrue privacy grant git

# Or sync will prompt automatically
aligntrue sync
```

## Team mode workflows

### Solo developer tracking latest

```yaml
mode: solo
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main
```

**Behavior**: Automatically pulls updates on sync (checks based on TTL, default 24 hours)

### Team with Approval

```yaml
mode: team
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main
```

**Workflow**:

1. Developer runs `aligntrue sync`
2. Update detected, sync blocked
3. Commit lockfile changes via PR for team review
4. Updates pulled and approved after PR merge
5. Team members sync to get new version

### Team with version pinning

```yaml
mode: team
sources:
  - type: git
    url: https://github.com/company/rules
    ref: v1.2.0 # Pinned to tag
```

**Upgrade workflow**:

```bash
# 1. Edit config to new version
# Edit .aligntrue/config.yaml and update the ref

# 2. Test
aligntrue sync --force-refresh --dry-run

# 3. Commit and PR
git add .aligntrue/config.yaml
git commit -m "chore: upgrade rules to v1.3.0"
```

## See also

- [Git sources guide](/docs/04-reference/git-sources) - Config-based permanent git sources
- [Command reference](/docs/04-reference/cli-reference) - Full command flag reference
- [Quickstart](/docs/00-getting-started/00-quickstart) - Initial setup and workflows
