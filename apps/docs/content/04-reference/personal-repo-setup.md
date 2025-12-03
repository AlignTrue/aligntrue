---
title: Personal repository setup
description: Guide for setting up a remote repository for personal rules
---

# Personal repository setup

Set up a remote git repository to version control and sync personal-scope rules across machines.

## Overview

For conceptual background on personal rules and storage options, see [Rule Visibility](/docs/03-concepts/rule-visibility).

In team mode, you can store personal-scope rules in three ways:

| Storage    | Version controlled    | Syncs across machines  |
| ---------- | --------------------- | ---------------------- |
| **Local**  | No                    | No                     |
| **Remote** | Yes                   | Yes                    |
| **Repo**   | Yes (with team rules) | Yes (shared with team) |

This guide covers setting up **remote storage** for personal rules.

## Prerequisites

- A git hosting account (GitHub, GitLab, Bitbucket, etc.)
- SSH access configured (recommended) or HTTPS with credentials

## Step 1: Create the Repository

### GitHub

1. Go to [github.com/new](https://github.com/new)
2. Name it something like `aligntrue-personal-rules`
3. Set visibility to **Private**
4. Do not initialize with README (AlignTrue will do this)
5. Click "Create repository"

### GitLab

1. Go to your GitLab instance
2. Click "New project" → "Create blank project"
3. Name it `aligntrue-personal-rules`
4. Set visibility to **Private**
5. Uncheck "Initialize repository with a README"
6. Click "Create project"

### Self-hosted Git

1. Create a new repository on your git server
2. Ensure you have read/write access
3. Note the SSH or HTTPS URL

## Step 2: Configure SSH Access (Recommended)

SSH is the recommended method because it doesn't require entering credentials repeatedly.

### Check existing SSH keys

```bash
ls -la ~/.ssh
```

Look for files like `id_rsa.pub`, `id_ed25519.pub`, or `id_ecdsa.pub`.

### Generate new SSH key (if needed)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept the default location. Optionally set a passphrase.

### Add SSH key to your git host

**GitHub:**

1. Copy your public key:
   ```bash
   cat ~/.ssh/id_ed25519.pub
   ```
2. Go to [github.com/settings/keys](https://github.com/settings/keys)
3. Click "New SSH key"
4. Paste the key and save

**GitLab:**

1. Copy your public key (same as above)
2. Go to your GitLab profile → SSH Keys
3. Paste the key and save

### Test SSH connection

```bash
# GitHub
ssh -T git@github.com

# GitLab
ssh -T git@gitlab.com
```

You should see a success message.

## Step 3: Configure AlignTrue

### During team migration

When you run `aligntrue team enable`, the wizard will prompt you:

```
What should we do with personal rules?
  ○ Promote to team (visible to all)
  ○ Move to remote (private, version controlled)
  ○ Keep local only (private, not version controlled)
```

Select "Move to remote" and follow the prompts.

### Manual configuration

Edit `.aligntrue/config.yaml`:

```yaml
mode: team

storage:
  team:
    type: repo
  personal:
    type: remote
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    branch: main
    path: rules # Optional subdirectory
```

Or using the new resources format:

```yaml
mode: team

resources:
  rules:
    scopes:
      team:
        sections: "*"
      personal:
        sections: "*"
    storage:
      team:
        type: repo
      personal:
        type: remote
        url: git@github.com:yourusername/aligntrue-personal-rules.git
        branch: main
```

## Step 4: Initial Sync

Run the sync command:

```bash
aligntrue sync
```

AlignTrue will:

1. Clone your personal repository to `.aligntrue/.remotes/personal/`
2. Write your personal rules to `rules.md` in that repository
3. Commit and push the changes

## Step 5: Verify

Check that your personal rules were pushed:

```bash
# View the remote repository
cd .aligntrue/.remotes/personal
git log

# Or check on your git host's web interface
```

## Troubleshooting

### SSH Connection Fails

**Error:** `Permission denied (publickey)`

**Fix:**

1. Verify SSH key is added to your git host
2. Test connection: `ssh -T git@github.com`
3. Check SSH agent is running: `ssh-add -l`
4. Add key to agent: `ssh-add ~/.ssh/id_ed25519`

### Clone fails

**Error:** `Repository not found`

**Fix:**

1. Verify the URL is correct
2. Ensure the repository exists
3. Check you have access to the repository
4. For private repos, ensure SSH key or credentials are configured

### Push fails

**Error:** `failed to push some refs`

**Fix:**

1. Pull latest changes first: `cd .aligntrue/.remotes/personal && git pull`
2. Resolve any conflicts manually
3. Run `aligntrue sync` again

### Wrong branch

**Error:** `Remote branch 'main' not found`

**Fix:**

Some repositories use `master` instead of `main`. Update your config:

```yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/aligntrue-personal-rules.git
    branch: master # Changed from main
```

## Using HTTPS instead of SSH

If you prefer HTTPS over SSH:

```yaml
storage:
  personal:
    type: remote
    url: https://github.com/yourusername/aligntrue-personal-rules.git
    branch: main
```

**Note:** You'll need to configure git credentials:

```bash
# Use credential helper
git config --global credential.helper store

# Or use SSH (recommended)
```

## Syncing across multiple machines

Once your personal rules are in a remote repository, you can sync them across machines:

1. On machine A: `aligntrue sync` (pushes changes)
2. On machine B: `aligntrue sync` (pulls changes)

AlignTrue automatically handles pull/push during sync.

## Backup considerations

Your personal rules are now backed up in two places:

1. **Remote repository** - Version controlled, accessible from anywhere
2. **Local backups** - `.aligntrue/.backups/personal/`

To restore from backup:

```bash
aligntrue revert
```

Select a backup with `scope: personal` to restore only personal rules.

## Security notes

- Always use **private** repositories for personal rules
- Use SSH keys instead of passwords
- Rotate SSH keys periodically
- Review repository access permissions regularly
- Consider using a dedicated SSH key for AlignTrue

## Next steps

- [Rule Visibility Workflows](/docs/01-guides/09-rule-visibility) - Step-by-step workflows
- [Team Mode Concepts](/docs/03-concepts/team-mode) - Understanding team mode
- [Rule Visibility Concepts](/docs/03-concepts/rule-visibility) - Understanding the three dimensions
- [Join an Existing Team](/docs/01-guides/03-join-team)
- [Troubleshooting Remote Access](/docs/05-troubleshooting/remote-access)
