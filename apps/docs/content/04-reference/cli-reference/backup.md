---
description: CLI reference for the aligntrue backup command
---

# backup

Manage local and remote backups of your `.aligntrue/` directory.

## Usage

```bash
aligntrue backup <subcommand> [options]
```

## Local backup subcommands

### create

Create a manual local backup.

```bash
aligntrue backup create [--notes <text>]
```

Options:

- `--notes <text>` - Add notes to the backup

Example:

```bash
aligntrue backup create --notes "Before major refactor"
```

### list

List all available local backups.

```bash
aligntrue backup list
```

Shows timestamp, creation source, file count, and notes for each backup.

### restore

Restore from a local backup.

```bash
aligntrue backup restore [--timestamp <id>]
```

Options:

- `--timestamp <id>` - Restore a specific backup (default: most recent)

Examples:

```bash
# Restore most recent backup
aligntrue backup restore

# Restore specific backup
aligntrue backup restore --timestamp 2025-10-29T12-34-56-789
```

### cleanup

Remove old local backups based on retention policy.

```bash
aligntrue backup cleanup
```

Uses settings from config:

- `backup.retention_days` - Remove backups older than N days (default: 30)
- `backup.minimum_keep` - Always keep at least N backups (default: 3)

## Remote backup subcommands

### push

Push rules to remote backup repositories.

```bash
aligntrue backup push [--dry-run] [--force]
```

Options:

- `--dry-run` - Preview changes without pushing
- `--force` - Force push even if no changes detected

Examples:

```bash
# Push to all configured remotes
aligntrue backup push

# Preview what would be pushed
aligntrue backup push --dry-run

# Force push without changes
aligntrue backup push --force
```

### status

Show remote backup configuration and status.

```bash
aligntrue backup status
```

Output example:

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

### setup

Interactive setup for remote backup.

```bash
aligntrue backup setup
```

Guides you through:

1. Entering repository URL
2. Configuring branch
3. Enabling auto-push
4. Optional initial push

## Global options

- `--config <path>` - Path to config file
- `--help` - Show help message

## Configuration

### Local backup config

```yaml
backup:
  retention_days: 30 # 0 = disable auto-cleanup
  minimum_keep: 3 # Safety floor
```

### Remote backup config

```yaml
remote_backup:
  default:
    url: git@github.com:user/rules.git
    branch: main
    auto: true # Push on sync

  additional:
    - id: public
      url: git@github.com:user/public-rules.git
      include:
        - typescript.md
        - "guides/*.md"
```

## Exit codes

- `0` - Success
- `1` - Error (backup not found, push failed, etc.)

## See also

- [Backup concepts](/concepts/backup)
- [Sharing rules](/guides/sharing-rules)
