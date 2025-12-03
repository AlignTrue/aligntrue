# Git workflows guide

Ad-hoc rule discovery and team sharing with git sources.

## Overview

AlignTrue supports intelligent git source management with automatic update checking:

- **Smart caching** - Branches check daily, tags weekly, commits never
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
    ref: main # Checks daily for updates
```

**Solo mode**: Automatically pulls updates on `aligntrue sync`  
**Team mode**: Blocks sync and requires approval with `aligntrue team approve`

### Tag references (stable)

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    ref: v1.2.0 # Checks weekly (catches force-pushes)
```

Tags are treated as stable but checked occasionally to detect force-pushes.

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
  branch_check_interval: 86400 # 24 hours (default)
  tag_check_interval: 604800 # 7 days (default)
  offline_fallback: true # Use cache if network fails
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

- **Branches** (`ref: main`) - Auto-updates daily
- **Tags** (`ref: v1.2.0`) - Stable, checks weekly
- **Commits** (`ref: abc1234`) - Pinned, never updates

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

## Vendoring workflows

Vendor rule aligns with git submodules or subtrees for offline use and version control.

### Why vendor?

- **Offline development** - Work without network access
- **Version control** - Lock rules to specific commits
- **Team review** - Rules changes appear in diffs
- **Security** - Audit vendored code in your repo

### Git submodule workflow

**Setup:**

```bash
# Add submodule
git submodule add https://github.com/org/rules vendor/aligntrue-rules

# Link with AlignTrue
aligntrue link https://github.com/org/rules --path vendor/aligntrue-rules

# Commit changes
git add .gitmodules vendor/aligntrue-rules .aligntrue.lock.json
git commit -m "feat: Vendor org rules"
```

**Team members:**

```bash
# After git pull
git submodule init
git submodule update
```

**Update vendored rules:**

```bash
cd vendor/aligntrue-rules
git pull origin main
cd ../..
git add vendor/aligntrue-rules
git commit -m "chore: Update org rules to latest"
```

### Git subtree workflow

**Setup:**

```bash
# Add subtree
git subtree add --prefix vendor/aligntrue-rules https://github.com/org/rules main --squash

# Link with AlignTrue
aligntrue link https://github.com/org/rules --path vendor/aligntrue-rules

# Commit changes
git add vendor/aligntrue-rules .aligntrue.lock.json
git commit -m "feat: Vendor org rules via subtree"
```

**Update vendored rules:**

```bash
git subtree pull --prefix vendor/aligntrue-rules https://github.com/org/rules main --squash
```

### Submodule vs Subtree

| Aspect     | Submodule                         | Subtree               |
| ---------- | --------------------------------- | --------------------- |
| Complexity | Requires `git submodule` commands | Just `git pull`       |
| History    | Separate history                  | Merged into main repo |
| Team setup | `git submodule init && update`    | No extra steps        |
| Disk space | Efficient (pointer)               | Full copy in repo     |
| Updates    | `git submodule update`            | `git subtree pull`    |

**Recommendation:** Subtrees for simplicity, submodules for space efficiency.

### When to vendor vs config

**Use vendoring (`aligntrue link`)** for:

- Production dependencies requiring version control
- Offline development workflows
- Team review of rule changes in PRs
- Security-sensitive environments needing code audits

**Use config-based git sources** for:

- Quick setup and adoption
- Automatic updates on sync
- Simpler workflow without git submodules/subtrees
- Most common use cases

### Team vendoring workflow

**Initial setup (team lead):**

```bash
# 1. Add submodule
git submodule add https://github.com/yourorg/team-rules vendor/team-rules

# 2. Link with AlignTrue
aligntrue link https://github.com/yourorg/team-rules --path vendor/team-rules

# 3. Commit
git add .gitmodules vendor/team-rules .aligntrue.lock.json
git commit -m "feat: Vendor team rules"
git push
```

**Team member setup:**

```bash
# 1. Pull changes
git pull

# 2. Initialize submodule
git submodule init
git submodule update

# 3. Verify
aligntrue sync --dry-run
```

**Update workflow (any team member):**

```bash
# 1. Update submodule
cd vendor/team-rules
git pull origin main
cd ../..

# 2. Test locally
aligntrue sync --dry-run

# 3. Commit and PR
git add vendor/team-rules
git commit -m "chore: Update team rules to latest"
git push
# Create PR for team review
```

### Team mode behavior

When team mode is enabled, `aligntrue link` warns if source not in allow list (but doesn't block):

```
⚠️  Team mode warning: Source not in allow list
  Repository: https://github.com/org/rules
  Add with: aligntrue team approve https://github.com/org/rules
```

This is non-blocking because:

- Vendoring is an explicit manual action
- Team reviews PR containing vendor changes
- More flexible than strict allow list enforcement

To add source to allow list after vendoring:

```bash
aligntrue team approve https://github.com/org/rules
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

# Use SSH for private repos
git clone git@github.com:yourorg/private-rules.git vendor/rules
aligntrue link git@github.com:yourorg/private-rules.git --path vendor/rules
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

## Sources command

Manage git sources with the `aligntrue sources` command:

### List sources

```bash
aligntrue sources list
```

Shows all configured sources (local and git).

### Status

```bash
aligntrue sources status
```

Detailed status of all sources including:

- Current cached SHA
- Last checked/fetched timestamps
- Whether check is overdue
- Cache status

### Update sources

```bash
# Update specific source
aligntrue sources update https://github.com/company/rules

# Update all git sources
aligntrue sources update --all
```

Forces a refresh of git sources, bypassing TTL.

### Pin to Commit

```bash
aligntrue sources pin https://github.com/company/rules abc1234
```

Pins a git source to a specific commit SHA in config.

## Team mode workflows

### Solo developer tracking latest

```yaml
mode: solo
sources:
  - type: git
    url: https://github.com/company/rules
    ref: main
```

**Behavior**: Automatically pulls updates on sync (checks daily)

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
3. Team lead runs `aligntrue team approve <url>`
4. Updates pulled and approved
5. Team syncs with new version

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
# 1. Test new version locally
aligntrue sources pin https://github.com/company/rules v1.3.0

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
