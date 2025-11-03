# Git sources guide

Pull AlignTrue rules from any git repository for sharing and collaboration.

## Why git sources

Git sources enable:

- **Team collaboration** - Share rules across projects via a central repository
- **Version control** - Track rule changes with standard git workflows
- **Distribution** - Publish reusable rule sets for your organization or community
- **Consistency** - Apply the same rules across multiple projects automatically

Instead of copying rules between projects, pull them from a single source of truth.

## Config-based usage

Git sources are configured in `.aligntrue/config.yaml` and pulled during `aligntrue sync`.

### Basic configuration

Add a git source to your config:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/aligntrue-rules
    ref: main
    path: .aligntrue.yaml
```

**Configuration fields:**

- `type: git` - Identifies this as a git source
- `url` - Repository URL (HTTPS or SSH)
- `ref` - Branch, tag, or commit SHA (default: `main`)
- `path` - File path within the repository (default: `.aligntrue.yaml`)

### Branch, tag, and commit support

You can reference specific branches, tags, or commits:

```yaml
# Use a specific branch
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: develop

# Use a tagged release
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: v1.2.0

# Pin to a specific commit
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: abc1234567890def
```

**Recommendation:** Use tags for stability (e.g., `v1.2.0`) or branches for continuous updates (e.g., `main`).

## Examples

### Public GitHub repository

```yaml
sources:
  - type: git
    url: https://github.com/AlignTrue/community-rules
    ref: main
    path: rules/typescript.yaml
```

First sync will prompt for [privacy consent](/reference/privacy#network-operations). AlignTrue clones the repository and extracts the specified file.

### Private repository with SSH

```yaml
sources:
  - type: git
    url: git@github.com:yourorg/private-rules.git
    ref: main
    path: .aligntrue.yaml
```

Requires SSH key authentication configured for the repository. See [Troubleshooting](#troubleshooting) for SSH setup.

### Multiple git sources with merge order

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/base-rules
    ref: main
    path: .aligntrue.yaml
  - type: git
    url: https://github.com/yourteam/team-rules
    ref: main
    path: .aligntrue.yaml
  - type: local
    path: .aligntrue/rules.md

scopes:
  - path: "."
    include: ["**/*"]
    rulesets:
      - source: 0 # Base rules
      - source: 1 # Team rules (overrides base)
      - source: 2 # Local rules (overrides all)
    merge:
      order: [root, path, local]
```

Sources are indexed from 0. Later sources override earlier ones via [hierarchical scopes](/concepts/sync-behavior#hierarchical-scopes).

## Local cache behavior

Git sources are cached locally in `.aligntrue/.cache/git/` for performance and offline access.

### Cache strategy

- **First sync** - Clones repository (shallow clone, depth 1)
- **Subsequent syncs** - Uses cached copy (no network call)
- **Offline fallback** - Uses cache when network unavailable

### Cache location

```
.aligntrue/
  .cache/
    git/
      <repo-hash>/     # SHA-256 hash of repository URL
        .git/          # Git repository data
        .aligntrue.yaml  # Extracted file
```

Cache is git-ignored by default (`.aligntrue/.cache/` in `.gitignore`).

### Force refresh

To bypass cache and pull fresh:

```bash
# Force refresh during sync
aligntrue sync --force-refresh

# Or delete cache manually
rm -rf .aligntrue/.cache/git/<repo-hash>
```

**Note:** To force a fresh clone, manually delete the cache directory.

## Privacy consent flow

Git sources require network access, which triggers AlignTrue's [privacy consent system](/reference/privacy#network-operations).

### First-time consent

When you first sync with a git source configured:

1. **Detect** - AlignTrue detects network operation needed (git clone)
2. **Error** - Clear error message with consent instructions
3. **Grant consent** - Run `aligntrue privacy grant git`
4. **Sync** - Network operation proceeds, consent remembered
5. **Remember** - No further prompts for git sources

**Example error:**

```
✖ Privacy consent required for git sources

To fetch rules from git repositories, grant consent:

  aligntrue privacy grant git

This enables network access to clone from specified repositories.
Consent is remembered in .aligntrue/privacy-consent.json
```

### Grant consent

```bash
aligntrue privacy grant git
```

This stores consent in `.aligntrue/privacy-consent.json` (git-ignored).

### Audit and revoke

View all granted consents:

```bash
aligntrue privacy audit
```

Revoke git consent:

```bash
aligntrue privacy revoke git
```

Future syncs will error until consent is granted again. See [Privacy & Telemetry](/reference/privacy) for full privacy documentation.

## Offline mode

Use `--offline` flag to skip all network operations:

```bash
aligntrue sync --offline
```

In offline mode:

- ✅ Uses cached git repositories
- ✅ Falls back gracefully if cache available
- ❌ Errors clearly if cache missing (no silent failures)

Great for air-gapped environments or when network is unreliable.

## Cache management

### View cache

```bash
ls -lh .aligntrue/.cache/git/
```

Shows all cached repositories with sizes.

### Clear specific cache

```bash
# Find repo hash
ls .aligntrue/.cache/git/

# Remove specific repository
rm -rf .aligntrue/.cache/git/<repo-hash>
```

### Clear all git caches

```bash
rm -rf .aligntrue/.cache/git/
```

Next sync will re-clone all repositories.

## Troubleshooting

### Authentication errors (private repositories)

**Error:**

```
✖ Git clone failed: authentication required
```

**Solution:**

For HTTPS URLs with private repositories:

```bash
# Configure git credential helper
git config --global credential.helper store

# Or use SSH instead
```

For SSH URLs:

```bash
# Ensure SSH key is added to ssh-agent
ssh-add ~/.ssh/id_ed25519

# Test SSH connection
ssh -T git@github.com
```

### Invalid branch or tag

**Error:**

```
✖ Git checkout failed: ref 'unknown-branch' not found
```

**Solution:**

- Check branch/tag name spelling in config
- Verify ref exists: `git ls-remote <url>`
- Try `main` or `master` as default branch

### Network failures

**Error:**

```
✖ Git clone failed: network unreachable
```

**Solutions:**

1. **Use offline mode** - `aligntrue sync --offline` (uses cache)
2. **Check network** - Verify internet connection
3. **Retry** - Network issues are often transient
4. **Use HTTPS** - Some networks block SSH (port 22)

### Permission denied (SSH)

**Error:**

```
✖ Git clone failed: permission denied (publickey)
```

**Solutions:**

1. **Add SSH key to GitHub/GitLab** - Upload public key to your account
2. **Check SSH agent** - `ssh-add -l` lists loaded keys
3. **Use HTTPS instead** - Works without SSH setup

### Shallow clone limitations

AlignTrue uses shallow clones (depth 1) for speed and space efficiency. This means:

- ✅ Fast cloning (only latest commit)
- ✅ Small cache size
- ❌ No git history available
- ❌ Cannot checkout old commits by SHA (use tags instead)

For full history, manually clone to a local directory and use `type: local` source instead.

## Coming soon: `aligntrue pull` CLI command

Interactive command for browsing and pulling rules from repositories:

```bash
aligntrue pull <repository-url>
```

This will enable one-command setup: browse available rule files, select which to import, automatically configure sources. Useful for discovering shared rules without manually editing config.

Until then, use the config-based approach documented above.

## See also

- [Quickstart Guide](/getting-started/quickstart) - Get started with AlignTrue
- [Command Reference](/reference/cli-reference) - All CLI commands including `sync`
- [Privacy & Telemetry](/reference/privacy) - Network operations and consent system
- [Sync Behavior](/concepts/sync-behavior) - How rules merge and override

---

**Last Updated:** 2025-10-29
