---
title: "Git sources"
description: "Pull AlignTrue rules from git repositories: configuration, workflows, and best practices."
---

# Git sources guide

Pull AlignTrue rules from any git repository for sharing and collaboration.

## Why git sources

Git sources enable:

- **Team collaboration** - Share rules across projects via a central repository
- **Version control** - Track rule changes with standard git workflows
- **Distribution** - Publish reusable rule sets for your organization or community
- **Consistency** - Apply the same rules across multiple projects automatically
- **Flexibility** - Works with any git host (GitHub, GitLab, Bitbucket, self-hosted, Gitea, etc.)

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
```

**Configuration fields:**

- `type: git` - Identifies this as a git source
- `url` - Repository URL (HTTPS or SSH)
  - HTTPS: `https://github.com/org/repo` or `https://gitlab.com/org/repo`
  - SSH: `git@github.com:org/repo.git`
  - Works with any git host: GitHub, GitLab, Bitbucket, self-hosted, Gitea, etc.
- `ref` - Branch, tag, or commit SHA (default: `main`)
- `path` - Path within the repository (optional, defaults to `"."` for directory scan)
  - Defaults to scanning the entire repository for `.md`/`.mdc` files
  - Can target a subdirectory: `rules/` or `.aligntrue/rules/`
  - Can target a single file: `rules/typescript.md`

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
    path: rules
```

First sync will prompt for privacy consent. AlignTrue clones the repository and scans for markdown rules. Run `aligntrue privacy grant git` to enable network access.

### Public GitHub repository (natural markdown)

```yaml
sources:
  - type: git
    url: https://github.com/yourfriend/coding-rules
    ref: main
    path: AGENTS.md
```

Pull natural markdown files directly from GitHub. Perfect for sharing rules in readable format.

### Private repository with SSH

```yaml
sources:
  - type: git
    url: git@github.com:yourorg/private-rules.git
    ref: main
    path: . # Scans directory for .md/.mdc files
```

Requires SSH key authentication configured for the repository. See [Troubleshooting](#troubleshooting) for SSH setup.

### Multiple files with new include syntax (recommended)

```yaml
sources:
  - type: git
    include:
      - https://github.com/yourorg/base-rules
      - https://github.com/yourteam/team-rules/aligns
      - https://github.com/security-team/rules@v2.0.0/security.md
```

Much cleaner! Each URL includes the host, org, repo, optional version (`@ref`), and optional path. No repetition.

`include` parsing uses HTTPS URLs and ignores any parent `ref`/`path` keys on the same entry. SSH for include is not supported; use the legacy form when you need SSH.

| Intent                    | URL example                                          | Resolved url/ref/path                                              |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Repo root, default branch | `https://github.com/org/rules`                       | url=`https://github.com/org/rules`, ref=`main`, path=`.`           |
| Repo root, tag            | `https://github.com/org/rules@v2.0.0`                | url=`https://github.com/org/rules`, ref=`v2.0.0`, path=`.`         |
| Directory on branch       | `https://github.com/org/rules/tree/dev/aligns`       | url=`https://github.com/org/rules`, ref=`dev`, path=`aligns`       |
| File on branch            | `https://github.com/org/rules/blob/main/security.md` | url=`https://github.com/org/rules`, ref=`main`, path=`security.md` |
| File with @ref shorthand  | `https://github.com/org/rules@dev/security.md`       | url=`https://github.com/org/rules`, ref=`dev`, path=`security.md`  |

**Precedence:** include entries are expanded in order; first match wins on duplicates. Local rules still override everything else.

### Multiple git sources with merge order (legacy)

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/base-rules
    ref: main
    path: . # Scans directory for .md/.mdc files
  - type: git
    url: https://github.com/yourteam/team-rules
    ref: main
    path: . # Scans directory for .md/.mdc files
  - type: local
    path: .aligntrue/rules
```

**Precedence order (first wins):**

1. Local rules (`.aligntrue/rules/`) - always included, always highest priority
2. First external source listed
3. Second external source listed
4. etc.

When the same rule appears in multiple sources, the first source wins.

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
        rules/         # Extracted markdown files
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

Git sources require network access, which triggers AlignTrue's privacy consent system.

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

If consent is missing and no cache exists, sync fails with:

```
Network operation requires consent
  Repository: <url>
  Grant consent with: aligntrue privacy grant git
  Or run with --offline to use cache only
```

### Audit and revoke

View all granted consents:

```bash
aligntrue privacy audit
```

Revoke git consent:

```bash
aligntrue privacy revoke git
```

Future syncs will error until consent is granted again. Run `aligntrue privacy grant git` to re-enable.

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

If cache is missing, the error includes the repository URL and instructs rerunning without `--offline` to fetch.

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

## Supported git hosts

AlignTrue works with any git repository accessible via HTTPS or SSH:

- **GitHub** - Both public and private repositories via HTTPS with credentials or SSH
- **GitLab** - Community, self-hosted, or cloud (gitlab.com)
- **Bitbucket** - Both Bitbucket Cloud and Bitbucket Server/Data Center
- **Gitea** - Self-hosted lightweight git service
- **Gitolite** - Self-hosted git server
- **Any self-hosted git server** - As long as git clone works with your URL

## Private repository support

### SSH URLs (recommended for private repos)

Use SSH URLs with SSH keys for best security:

```yaml
sources:
  - type: git
    url: git@github.com:yourorg/private-rules.git
    ref: main
```

**Setup:**

1. Generate or use existing SSH key:

```bash
# Generate new key (if needed)
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519

# Add key to ssh-agent
ssh-add ~/.ssh/id_ed25519
```

2. Add public key to your git host (GitHub, GitLab, Bitbucket, etc.)

3. Test connection:

```bash
ssh -T git@github.com        # GitHub
ssh -T git@gitlab.com        # GitLab
ssh -T git@bitbucket.org     # Bitbucket
ssh -T git@your-gitea-server # Self-hosted
```

### HTTPS with git credentials

For HTTPS URLs with private repositories:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/private-rules.git
    ref: main
```

**Setup:**

Store credentials globally:

```bash
# Use credential helper to store credentials securely
git config --global credential.helper store

# For macOS with Keychain:
git config --global credential.helper osxkeychain

# For Windows:
git config --global credential.helper wincred

# For Linux with pass:
git config --global credential.helper pass
```

Or use personal access tokens (GitHub, GitLab):

```bash
git config --global user.name "Your Name"
git config --global credential.https://github.com.username "your-username"
git config --global credential.https://github.com.password "ghp_your_token"
```

## Troubleshooting

### Authentication errors (private repositories)

**Error:**

```
✖ Git clone failed: authentication required
```

**Solution:**

For SSH URLs, ensure SSH key is configured:

```bash
# Check loaded SSH keys
ssh-add -l

# Add key to ssh-agent
ssh-add ~/.ssh/id_ed25519

# Test SSH connection
ssh -T git@github.com
```

For HTTPS URLs, configure git credentials as shown above.

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

### Submodules not fetched

AlignTrue uses shallow clones and does not initialize submodules. If your rules live in a submodule, point to that submodule's repository directly as its own git source or vendor the files locally with `type: local`.

### Shallow clone limitations

AlignTrue uses shallow clones (depth 1) for speed and space efficiency. This means:

- ✅ Fast cloning (only latest commit)
- ✅ Small cache size
- ❌ No git history available
- ❌ Cannot checkout old commits by SHA (use tags instead)

For full history, manually clone to a local directory and use `type: local` source instead.

---

## See also

- [Quickstart Guide](/docs/00-getting-started/00-quickstart) - Get started with AlignTrue
- [Command Reference](/docs/04-reference/cli-reference) - All CLI commands including `sync`
- [CLI: aligntrue sources](/docs/04-reference/cli-reference/core#aligntrue-sources) - Complete command reference
- [CLI: aligntrue remove source](/docs/04-reference/cli-reference/core#aligntrue-remove-source) - Remove command reference
- [Sync Behavior](/docs/03-concepts/sync-behavior) - How rules merge and override
- [Backup & restore](/docs/04-reference/backup-restore) - Backup retention and cleanup
- [Team mode](/docs/03-concepts/team-mode) - Team workflows and approval gates

---

**Last Updated:** 2025-10-29
