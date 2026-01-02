---
description: CLI reference for the aligntrue backup and revert commands (local only)
---

# Backups

Manage local backups of your `.aligntrue/` directory. For pushing rules to git remotes, use the `remotes` commands.

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

---

## `aligntrue revert`

Restore specific files from backup with preview before applying.

**Usage:**

```bash
aligntrue revert [options]
```

**Options:**

| Flag          | Alias | Description                                         | Default                  |
| ------------- | ----- | --------------------------------------------------- | ------------------------ |
| `--timestamp` |       | Restore from specific backup (default: most recent) | Most recent              |
| `--file`      |       | Restore specific file (shows preview first)         | All files                |
| `--force`     |       | Skip confirmation prompt                            | `false`                  |
| `--config`    | `-c`  | Custom config file path                             | `.aligntrue/config.yaml` |

**What it does:**

1. Shows preview of files that will be restored
2. Optionally filters to specific file
3. Prompts for confirmation (unless `--force`)
4. Restores selected files from backup
5. Updates working directory

**Examples:**

```bash
# Preview and restore from most recent backup
aligntrue revert

# Preview before restoring specific file
aligntrue revert --file .cursor/rules/typescript.md

# Restore from specific backup with preview
aligntrue revert --timestamp 2025-10-29T12-34-56-789

# Restore without confirmation (use carefully)
aligntrue revert --force
```

**Exit codes:**

- `0` - Success
- `1` - No backup found, file not in backup
- `2` - System error (permissions, restore failed)

### cleanup

Remove old local backups based on retention policy.

```bash
aligntrue backup cleanup
```

Uses settings from config:

- `backup.retention_days` - Remove backups older than N days (default: 30)
- `backup.minimum_keep` - Always keep at least N backups (default: 3)

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

## Exit codes

- `0` - Success
- `1` - Error (backup not found, push failed, etc.)

## See also

- [Backup concepts](/concepts/backup)
- [Sharing rules](/guides/sharing-rules)
