---
description: Guide for sharing your rules with others using remote backup
---

# Sharing rules

This guide explains how to share your AlignTrue rules with others using remote backup.

## Overview

There are two ways others can use your rules:

1. **As a source** - They add your repository as a git source and pull updates
2. **One-time import** - They copy your rules with `aligntrue add`

To share rules, you need to publish them to a git repository that others can access.

## Setting up a shared rules repository

### Step 1: Create a repository

Create a new repository on GitHub, GitLab, or your preferred git host:

- For public sharing: Create a public repository
- For team/private sharing: Create a private repository with appropriate access

### Step 2: Configure remote backup

Add the repository as a remote backup in your AlignTrue config:

```yaml
remote_backup:
  default:
    url: git@github.com:username/shared-rules.git
    branch: main
    auto: true
```

### Step 3: Push your rules

Push your rules to the repository:

```bash
aligntrue sync           # Exports to agents and pushes to backup
# Or just push:
aligntrue backup push
```

### Step 4: Share with others

Share the repository URL with others. They can consume your rules as a source:

```yaml
# Their config
sources:
  - type: git
    url: https://github.com/username/shared-rules.git
    ref: main
```

## Separating public and private rules

You may want to share some rules publicly while keeping others private. Use multiple backup destinations:

```yaml
remote_backup:
  default:
    url: git@github.com:username/private-rules.git
    # Gets all files NOT in additional backups

  additional:
    - id: public
      url: git@github.com:username/public-rules.git
      include:
        - typescript.md
        - testing.md
        - "guides/*.md" # Glob patterns supported
```

This configuration:

- Pushes `typescript.md`, `testing.md`, and files in `guides/` to your public repo
- Pushes everything else to your private repo

## For maintainers: Workflow

As a rules maintainer:

1. **Edit rules locally** - Make changes in `.aligntrue/rules/`
2. **Test changes** - Run `aligntrue sync` to verify exports
3. **Push to remote** - Your backup auto-pushes on sync

Your rules repository structure:

```
your-rules-repo/
  typescript.md
  testing.md
  guides/
    react.md
    vue.md
```

Consumers receive these files when they sync from your repository.

## For consumers: Using shared rules

### Option 1: Link as a source (get updates)

Add the repository as a source to get ongoing updates:

```bash
aligntrue add --link https://github.com/username/shared-rules.git
```

Or manually add to config:

```yaml
sources:
  - type: git
    url: https://github.com/username/shared-rules.git
    ref: main # Or a specific tag/commit for stability
```

Run `aligntrue sync` to pull updates.

### Option 2: One-time import (copy)

Copy rules to your local `.aligntrue/rules/`:

```bash
aligntrue add https://github.com/username/shared-rules.git
```

This copies the rules locally. You won't get updates unless you run `add` again.

## Personal rules across machines

Use remote backup to sync your personal rules across multiple machines:

### Machine A (primary)

```yaml
remote_backup:
  default:
    url: git@github.com:username/my-rules.git
    auto: true
```

### Machine B (secondary)

Option 1: Use as source (pull only):

```yaml
sources:
  - type: git
    url: git@github.com:username/my-rules.git
    personal: true # Skip team approval
```

Option 2: Also backup from Machine B:

```yaml
sources:
  - type: git
    url: git@github.com:username/my-rules.git
    personal: true

remote_backup:
  default:
    url: git@github.com:username/my-rules.git
```

With Option 2, edits on either machine will push to the remote. Be careful of conflicts.

## Version pinning

For stability, consumers can pin to a specific version:

```yaml
sources:
  - type: git
    url: https://github.com/username/shared-rules.git
    ref: v1.2.0 # Pin to tag
```

Or a specific commit:

```yaml
sources:
  - type: git
    url: https://github.com/username/shared-rules.git
    ref: abc123def # Pin to commit SHA
```

## Best practices

### For maintainers

- Use semantic versioning tags for releases
- Document breaking changes in your repository
- Keep rules focused and well-documented
- Consider separating stable rules from experimental ones

### For consumers

- Pin to tags or commits for production use
- Review updates before merging in team mode
- Fork repositories for critical dependencies

## Related

- [Backup concepts](/concepts/backup)
- [Sources and imports](/concepts/sources)
- [Team mode](/concepts/team-mode)
