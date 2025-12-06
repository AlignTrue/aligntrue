---
title: Personal repository setup
description: Guide for setting up remote sources and personal remotes (push)
---

# Personal repository setup

Set up remote git repositories to pull and push personal rules across machines.

> **Conceptual overview:** For detailed information about rule privacy, sharing, and remote routing, see [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy).

## Overview

There are two ways to use remote repositories with AlignTrue:

| Purpose                    | Config                     | Direction      |
| -------------------------- | -------------------------- | -------------- |
| **Pull rules from remote** | `sources` with `type: git` | Remote → Local |
| **Sync rules to remote**   | `remotes`                  | Local → Remote |

Use git sources to pull rules; use remotes to push rules. Personal sources are auto-scoped to `personal` and gitignored.

## Quick start (SSH + personal remote)

1. Ensure `.aligntrue/config.yaml` exists (`aligntrue init` if not).
2. Add this config:

```yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    personal: true # scope personal + gitignore (SSH URLs auto-apply this)

remotes:
  personal:
    url: git@github.com:yourusername/personal-rules.git
    # Optional: set auto: true to push during sync; default is manual via `aligntrue remotes push`
    branch: main # default; change if your remote uses another branch
```

3. Sync:

```bash
aligntrue sync
```

Use `aligntrue remotes push` to publish. Set `auto: true` on a remote only if you want to push during `aligntrue sync`. Use HTTPS if SSH is blocked in your environment.

## Prerequisites

- A git hosting account (GitHub, GitLab, Bitbucket, etc.)
- SSH access configured (recommended) or HTTPS with credentials

## Step 1: Create the repository

### GitHub

1. Go to [github.com/new](https://github.com/new)
2. Name it something like `aligntrue-personal-rules`
3. Set visibility to **Private**
4. Do not initialize with README
5. Click "Create repository"

### GitLab

1. Go to your GitLab instance
2. Click "New project" → "Create blank project"
3. Name it `aligntrue-personal-rules`
4. Set visibility to **Private**
5. Uncheck "Initialize repository with a README"
6. Click "Create project"

## Step 2: Configure SSH access (recommended)

### Check existing SSH keys

```bash
ls -la ~/.ssh
```

Look for files like `id_rsa.pub`, `id_ed25519.pub`, or `id_ecdsa.pub`.

### Generate new SSH key (if needed)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

### Add SSH key to your git host

**GitHub:**

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
2. Go to [github.com/settings/keys](https://github.com/settings/keys)
3. Click "New SSH key"
4. Paste the key and save

### Test SSH connection

```bash
# GitHub
ssh -T git@github.com

# GitLab
ssh -T git@gitlab.com
```

## Step 3: Configure AlignTrue

### To pull personal rules from a remote

Use the git source from the quick start. `personal: true` scopes imported rules to `personal` and gitignores them; SSH URLs apply these defaults automatically.

### To sync local rules to a remote

- Push is manual by default (`aligntrue remotes push`). Set `auto: true` on a remote only if you want to push during `aligntrue sync`.
- `branch` defaults to `main`; set it if your remote uses another branch.
- Mark rules with a scope so they route to the right remote:

```yaml
---
title: My Preference
scope: personal
---
```

For custom pattern-based routing (additive):

```yaml
remotes:
  personal: git@github.com:yourusername/personal-rules.git
  custom:
    - id: typescript
      url: git@github.com:yourusername/typescript-rules.git
      include: ["typescript*.md", "eslint*.md"]
```

Custom remotes are additive - files can go to multiple destinations.

## Step 4: Sync and publish

```bash
aligntrue sync
```

This will pull rules from configured git sources. Publish to remotes with `aligntrue remotes push` (or set `auto: true` on specific remotes to push during sync).

## Troubleshooting

### SSH connection fails

**Error:** `Permission denied (publickey)`

**Fix:**

1. Verify SSH key is added to your git host
2. Test connection: `ssh -T git@github.com`
3. Check SSH agent: `ssh-add -l`
4. Add key to agent: `ssh-add ~/.ssh/id_ed25519`

### Clone fails

**Error:** `Repository not found`

**Fix:**

1. Verify the URL is correct
2. Ensure the repository exists
3. Check you have access

### Push fails (remotes)

**Error:** `failed to push some refs`

**Fix:**

1. The remote repo may have diverged
2. Check `.aligntrue/.cache/remotes/` for the local clone (safe to delete; it will re-clone on next sync)
3. Manually resolve conflicts if needed

## Using HTTPS instead of SSH

```yaml
sources:
  - type: git
    url: https://github.com/yourusername/aligntrue-personal-rules.git
    personal: true
```

Configure git credentials:

```bash
git config --global credential.helper osxkeychain   # macOS
# or
git config --global credential.helper manager-core   # Linux/Windows
```

## Security notes

- Always use **private** repositories for personal rules
- Use SSH keys instead of passwords
- Review repository access permissions regularly

## See also

- [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy) - Complete guide to rule privacy, scoping, and remote synchronization
- [Working with external sources](/docs/01-guides/04-external-sources) - Adding and customizing external rules
- [Source and remote issues](/docs/05-troubleshooting/source-remote-issues) - Solutions for SSH and connection issues
