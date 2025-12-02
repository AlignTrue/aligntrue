---
description: Understanding local and remote backups in AlignTrue
---

# Backup

AlignTrue provides two types of backup functionality: local backups for safety snapshots, and remote backups for pushing rules to git repositories.

## Local backups

Local backups create snapshots of your `.aligntrue/` directory before potentially destructive operations. They are stored in `.aligntrue/.backups/` and are automatically managed.

### Automatic backups

AlignTrue creates safety backups automatically before:

- Running `aligntrue sync`
- Restoring from a backup
- Running migrations

### Manual backups

Create a backup manually with optional notes:

```bash
aligntrue backup create --notes "Before major refactor"
```

### Retention policy

Configure retention in `.aligntrue/config.yaml`:

```yaml
backup:
  retention_days: 30 # Remove backups older than 30 days
  minimum_keep: 3 # Always keep at least 3 backups
```

Set `retention_days: 0` to disable automatic cleanup.

## Remote backups

Remote backups push your local rules to git repositories. This is unidirectional: your `.aligntrue/rules/` directory is the source of truth, and changes are pushed to remote.

### Why use remote backup?

- Backup your rules to a private repository
- Share rules with yourself across machines
- Publish rules for others to consume as a source
- Separate public and private rules to different repositories

### Configuration

Add a `remote_backup` section to your config:

```yaml
remote_backup:
  default:
    url: git@github.com:username/rules-backup.git
    branch: main
    auto: true # Push on every sync
```

### Multiple backup destinations

You can push different files to different repositories:

```yaml
remote_backup:
  default:
    url: git@github.com:username/all-rules.git
    # Gets all files NOT assigned to additional backups

  additional:
    - id: public-oss
      url: git@github.com:username/public-rules.git
      include:
        - typescript.md
        - testing.md
        - "guides/*.md"

    - id: company
      url: git@github.com:company/standards.git
      include:
        - security.md
        - compliance.md
```

Each file belongs to exactly one backup destination. The first matching `include` pattern wins.

### Source vs backup

A URL cannot be both a source and a backup in the same project:

| Role   | Direction | You are...                             |
| ------ | --------- | -------------------------------------- |
| Source | Pull      | Consumer (receive updates from remote) |
| Backup | Push      | Maintainer (send updates to remote)    |

If the same URL appears in both `sources` and `remote_backup`, the backup for that URL is skipped with a warning.

### Pushing manually

Push to all configured backups:

```bash
aligntrue backup push
```

Preview what would be pushed:

```bash
aligntrue backup push --dry-run
```

Force push even without changes:

```bash
aligntrue backup push --force
```

### Auto-push on sync

When `auto: true` (the default), remote backups are pushed automatically after every successful sync:

```bash
aligntrue sync
# ✓ Synced to agents (4 exporters)
# ✓ Backed up to github.com/user/rules (12 files)
```

Disable auto-push for specific backups:

```yaml
remote_backup:
  default:
    url: git@github.com:username/rules.git
    auto: false # Only push with explicit `aligntrue backup push`
```

### Checking status

See your backup configuration and last push:

```bash
aligntrue backup status
```

Output:

```
Backup Configuration:
  default: github.com/user/all-rules (8 files)
  public-oss: github.com/user/open-rules (4 files)
    - typescript.md
    - testing.md
    - guides/react.md
    - guides/vue.md

Last push: 2 hours ago
```

## Personal sources and team mode

In team mode, sources marked as `personal: true` skip team approval requirements:

```yaml
mode: team
sources:
  - type: git
    url: git@github.com:team/standards.git # Team source - approval required

  - type: git
    url: git@github.com:me/personal.git
    personal: true # Personal - no approval needed
    gitignore: true # Not committed to team repo
```

This lets team members have personal rules that:

- Update without team approval
- Are not committed to the shared repository
- Are backed up to their own private repository

## Gitignored rules

Rules from sources with `gitignore: true` or rules with `gitignore: true` in frontmatter are automatically added to `.gitignore`:

```yaml
# In config
sources:
  - type: git
    url: git@github.com:me/private-rules.git
    gitignore: true
```

Or in rule frontmatter:

```yaml
---
title: My Personal Preferences
gitignore: true
---
```

SSH URLs (`git@...`) automatically set `gitignore: true`.

## Related

- [CLI reference: backup](/reference/cli/backup)
- [Sharing rules with others](/guides/sharing-rules)
- [Team mode](/concepts/team-mode)
