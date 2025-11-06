# Git workflows guide

Ad-hoc rule discovery and team sharing with the `aligntrue pull` command.

## Why pull command

The `aligntrue pull` command enables flexible git-based workflows:

- **Try before commit** - Test rules from any repository without modifying your config
- **Quick discovery** - Explore community and team rules with a single command
- **Share by URL** - Team members share git URLs for instant rule access
- **No config changes** - Pull to temp by default, save only when ready

This complements [config-based git sources](/docs/04-reference/git-sources) for permanent rule subscriptions.

## When to use pull vs config

**Use `aligntrue pull`** for:

- Testing rules before committing to them
- Exploring unfamiliar rule sets
- Sharing rules via URL (Slack, docs, PRs)
- One-time rule imports

**Use [config-based git sources](/docs/04-reference/git-sources)** for:

- Permanent rule subscriptions
- Team-wide rule enforcement
- Automatic updates on sync
- Reproducible builds

## Basic usage

Pull rules from any git repository:

```bash
aligntrue pull https://github.com/yourorg/rules
```

**What happens:**

1. Privacy consent prompt (first time only)
2. Repository cloned to `.aligntrue/.cache/git/`
3. Rules extracted from `.aligntrue.yaml` (default path)
4. Results displayed with rule count and profile info
5. **Config not modified** - rules in cache only

**Output example:**

```
📦 Pull results:

  Repository: https://github.com/yourorg/rules
  Ref: main
  Rules: 12
  Profile: yourorg-typescript
  Location: .aligntrue/.cache/git (cached)

✓ Rules pulled (temporary - not saved to config)
```

## Flags

### `--ref <branch|tag|commit>`

Pull from specific branch, tag, or commit:

```bash
# Pull from branch
aligntrue pull https://github.com/yourorg/rules --ref develop

# Pull tagged release
aligntrue pull https://github.com/yourorg/rules --ref v1.2.0

# Pin to specific commit
aligntrue pull https://github.com/yourorg/rules --ref abc1234
```

**When to use:**

- **Branches** - Test latest changes before they hit main
- **Tags** - Lock to stable releases for team consistency
- **Commits** - Debug specific rule versions

### `--save`

Add git source to config permanently:

```bash
aligntrue pull https://github.com/yourorg/rules --save
```

**What happens:**

1. Rules pulled and cached
2. Source added to `.aligntrue/config.yaml`
3. Future `aligntrue sync` commands include this source

**Config result:**

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: main
```

**When to use:**

- After testing rules and deciding to keep them
- When setting up new projects with team rules
- Converting ad-hoc pulls to permanent sources

### `--sync`

Pull, save, and sync in one step:

```bash
aligntrue pull https://github.com/yourorg/rules --save --sync
```

**What happens:**

1. Rules pulled and cached
2. Source added to config
3. `aligntrue sync` runs immediately
4. Agent files updated with new rules

**Requires:** Must use with `--save` (cannot sync temporary pulls)

**When to use:**

- Fast setup for new projects
- Quick adoption of team rules
- Onboarding workflows

### `--dry-run`

Preview what would be pulled without network operations:

```bash
aligntrue pull https://github.com/yourorg/rules --dry-run
```

**Output:**

```
🔍 Dry run preview:

  Repository: https://github.com/yourorg/rules
  Ref: main
  Action: Would pull rules from repository
  Location: Would cache in .aligntrue/.cache/git
  Config: Would NOT modify (use --save to persist)

✓ Dry run complete (no changes made)
```

**When to use:**

- Validate URLs before pulling
- Check command behavior
- Documentation and testing

**Note:** Excludes `--save` and `--sync` (incompatible with dry run)

### `--offline`

Use cached repository only, no network operations:

```bash
aligntrue pull https://github.com/yourorg/rules --offline
```

**When to use:**

- Working offline (airplane, poor connection)
- CI/CD with pre-warmed cache
- Avoiding network consent prompts

**Requires:** Repository must already be cached from previous pull

**Error if cache missing:**

```
Offline mode: no cache available for repository
  Repository: https://github.com/yourorg/rules
  Run without --offline to fetch from network
```

### `--config <path>`

Use custom config file:

```bash
aligntrue pull https://github.com/yourorg/rules --config .aligntrue/team.yaml
```

**When to use:**

- Multiple config files per project
- Testing config changes
- Team-specific configurations

## Common workflows

### Solo developer: Try before commit

Test rules before adding to config:

```bash
# Step 1: Pull and inspect
aligntrue pull https://github.com/community/typescript-rules

# Step 2: Review rules in cache
cat .aligntrue/.cache/git/<hash>/.aligntrue.yaml

# Step 3: If satisfied, pull with --save
aligntrue pull https://github.com/community/typescript-rules --save

# Step 4: Sync to agents
aligntrue sync
```

### Team: Quick onboarding

New team member setup:

```bash
# Pull, save, and sync in one command
aligntrue pull https://github.com/yourorg/team-rules --save --sync

# Result: All team rules applied to local agents
```

### Team: Share experimental rules

Share rules via Slack or PR comments:

```markdown
Try these new TypeScript rules:
aligntrue pull https://github.com/yourorg/rules --ref experiment/strict-types
```

Team members test without committing. If approved, update team config:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: experiment/strict-types # Or merge to main and use 'main'
```

### CI/CD: Pre-warm cache

Cache rules in CI for offline builds:

```bash
# Setup step (with network)
aligntrue pull https://github.com/yourorg/rules

# Build step (offline)
aligntrue pull https://github.com/yourorg/rules --offline
aligntrue sync --dry-run  # Validate without writing
```

### Version pinning

Lock to specific rule version:

```bash
# Development: Use latest
aligntrue pull https://github.com/yourorg/rules

# Production: Pin to tag
aligntrue pull https://github.com/yourorg/rules --ref v1.2.0 --save
```

Update pinned version when ready:

```bash
aligntrue pull https://github.com/yourorg/rules --ref v1.3.0 --save
aligntrue sync
```

## Privacy and consent

First git pull triggers consent prompt:

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

**Offline mode skips consent:**

```bash
# No consent prompt (uses cache only)
aligntrue pull https://github.com/yourorg/rules --offline
```

See [Privacy guide](/docs/07-policies/privacy) for full consent documentation.

## Vendoring workflows

Vendor rule packs with git submodules or subtrees for offline use and version control.

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

### When to vendor vs pull

**Use vendoring (`aligntrue link`)** for:

- Production dependencies requiring version control
- Offline development workflows
- Team review of rule changes in PRs
- Security-sensitive environments needing code audits

**Use pull (`aligntrue pull`)** for:

- Quick exploration and experimentation
- Testing rules before vendoring
- Sharing rules via URL (temporary)
- CI/CD with network access

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
aligntrue pull git@github.com:yourorg/private-rules.git

# Work offline with cache
aligntrue pull https://github.com/yourorg/rules --offline
```

### Authentication failures

**Symptom:** `Authentication failed` for private repositories

**Solution:** Configure git credentials:

```bash
# HTTPS with token
git config --global credential.helper store
# Then pull once with token to cache

# SSH keys (recommended)
ssh-add ~/.ssh/id_rsa
aligntrue pull git@github.com:yourorg/private-rules.git
```

### Missing rules file

**Symptom:** `File not found: .aligntrue.yaml`

**Cause:** Repository doesn't have rules at default path

**Solution:** Specify custom path in config:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    path: rules/typescript.yaml # Custom path
```

**Note:** Pull command uses `.aligntrue.yaml` by default. For custom paths, add source to config manually and run `aligntrue sync`.

### Cache corruption

**Symptom:** Cached repository exists but rules can't be read

**Solution:** Clear cache and re-pull:

```bash
# Remove corrupted cache
rm -rf .aligntrue/.cache/git

# Pull fresh copy
aligntrue pull https://github.com/yourorg/rules
```

### Consent denied

**Symptom:** `Network operation requires consent`

**Solution:** Grant consent:

```bash
# Interactive grant
aligntrue privacy grant git

# Or pull will prompt automatically
aligntrue pull https://github.com/yourorg/rules
```

## See also

- [Git sources guide](/docs/04-reference/git-sources) - Config-based permanent git sources
- [Command reference](/docs/04-reference/cli-reference) - Full `aligntrue pull` flag reference
- [Privacy guide](/docs/07-policies/privacy) - Network consent and privacy management
- [Quickstart](/docs/00-getting-started/00-quickstart) - Initial setup and workflows
