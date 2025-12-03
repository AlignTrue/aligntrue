---
title: Personal repository setup
description: Guide for setting up remote sources and backup for personal rules
---

# Personal repository setup

Set up remote git repositories to pull and backup personal rules across machines.

> **Conceptual overview:** For detailed information about rule privacy, sharing, and remote routing, see [Rule Privacy and Sharing](/docs/01-guides/09-rule-privacy-sharing).

## Overview

There are two ways to use remote repositories with AlignTrue:

| Purpose                    | Config                     | Direction      |
| -------------------------- | -------------------------- | -------------- |
| **Pull rules from remote** | `sources` with `type: git` | Remote → Local |
| **Sync rules to remote**   | `remotes`                  | Local → Remote |

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

Add the remote as a source in `.aligntrue/config.yaml`:

```yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    personal: true # Auto-gitignored and personal-scope
```

The `personal: true` flag:

- Marks rules from this source as `scope: personal`
- Auto-applies `gitignore: true` (not committed to main repo)
- SSH URLs automatically get these flags

### To sync local rules to a remote

Configure remotes based on rule scopes:

```yaml
remotes:
  # Personal-scope rules sync here
  personal: git@github.com:yourusername/personal-rules.git

  # Shared-scope rules sync here (for publishing)
  shared: git@github.com:yourusername/shared-rules.git
```

Then mark your rules with the appropriate scope:

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

## Step 4: Sync

```bash
aligntrue sync
```

This will:

- Pull rules from configured git sources
- Push rules to configured remotes based on their scope (if `auto: true`, the default)

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
2. Check `.aligntrue/.cache/remotes/` for the local clone
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
git config --global credential.helper store
```

## Security notes

- Always use **private** repositories for personal rules
- Use SSH keys instead of passwords
- Review repository access permissions regularly

## Related

- [Rule Privacy and Sharing](/docs/01-guides/09-rule-privacy-sharing) - Complete guide to rule privacy, scoping, and remote synchronization
- [Managing Sources](/docs/01-guides/07-managing-sources) - Adding and customizing external rules
- [Troubleshooting Remote Access](/docs/05-troubleshooting/remote-access) - Solutions for SSH and connection issues
