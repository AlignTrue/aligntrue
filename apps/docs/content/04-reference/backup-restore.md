---
title: "Backup & restore"
description: "Manual and automatic backup functionality to protect configuration and rules. Create backups before sync, restore specific files, and manage backup retention."
---

# Backup & restore

AlignTrue provides backup and restore functionality to protect your configuration and rules from accidental changes. This is particularly useful before making potentially destructive changes like sync operations or imports.

## Quick start

### Manual backup

Create a backup before making changes:

```bash
aligntrue backup create --notes "Before major sync"
```

### Restore from backup

List available backups:

```bash
aligntrue backup list
```

Restore the most recent backup:

```bash
aligntrue backup restore
```

Restore a specific backup:

```bash
aligntrue backup restore --to 2025-10-29T14-30-00-000
```

### Auto-backup with sync

Enable automatic backups before sync operations in `.aligntrue/config.yaml`:

```yaml
backup:
  auto_backup: true
  backup_on: ["sync"]
  keep_count: 10
```

## Configuration

Add the `backup` section to your `.aligntrue/config.yaml`:

```yaml
backup:
  # Enable/disable automatic backups (default: false)
  auto_backup: false

  # Commands that trigger auto-backup (default: ["sync"])
  backup_on:
    - sync
    - import
    - restore

  # Number of backups to keep (default: 20)
  # Older backups are automatically deleted
  keep_count: 20
```

### Configuration options

- **`auto_backup`** (boolean): Enable automatic backups before destructive operations
  - Default: `true`
  - Recommended for all users to prevent accidental data loss
  - Minimal performance impact (~10-50ms per backup)

- **`backup_on`** (array): Which commands trigger automatic backups
  - Default: `["sync"]`
  - Options: `"sync"`, `"import"`, `"restore"`
  - Only applies when `auto_backup: true`

- **`keep_count`** (number): How many backups to retain
  - Default: 20
  - Range: 1-100
  - Older backups deleted automatically after successful operations

## CLI commands

### `aligntrue backup create`

Create a manual backup:

```bash
# Basic backup
aligntrue backup create

# With notes
aligntrue backup create --notes "Before experimental changes"
```

**Options:**

- `--notes <text>` - Optional description for the backup

**Output:**

- Creates timestamped backup in `.aligntrue/.backups/<timestamp>/`
- Displays backup timestamp and restore command

### `aligntrue backup list`

List all available backups:

```bash
aligntrue backup list
```

**Output:**

- Shows backups from newest to oldest
- Displays timestamp, created date, and notes
- Shows number of files backed up

**Example output:**

```
Available backups:
  2025-10-29T14-30-00-000  2 files  Auto-backup before sync
  2025-10-29T12-15-45-123  3 files  Before major refactor
  2025-10-28T18-45-30-456  2 files  Manual backup

3 backups found
```

### `aligntrue backup restore`

Restore from a backup:

```bash
# Restore most recent backup
aligntrue backup restore

# Restore specific backup by timestamp
aligntrue backup restore --to 2025-10-29T14-30-00-000
```

**Options:**

- `--to <timestamp>` - Specific backup to restore (from `backup list`)

**Behavior:**

- Creates temporary backup before restore (safety net)
- Atomically restores all files from backup
- Rolls back to temporary backup if restore fails
- Cleans up temporary backup on success

**Warning:** This overwrites current `.aligntrue/` directory contents. Make sure you have the right timestamp.

### `aligntrue revert`

Restore files from backup with preview:

```bash
# Interactive: choose backup and preview changes
aligntrue revert

# Restore specific file with diff preview
aligntrue revert AGENTS.md

# Restore specific file from specific backup
aligntrue revert AGENTS.md --timestamp 2025-10-29T14-30-00-000

# Skip confirmation
aligntrue revert AGENTS.md -y
```

**Options:**

- `--timestamp <id>` or `-t` - Specific backup timestamp
- `--yes` or `-y` - Skip confirmation prompts

**Features:**

- **Interactive selection** - Choose from available backups
- **Diff preview** - See exactly what will change before restoring
- **Selective restore** - Restore single files instead of full backup
- **Colored diff** - Green for additions, red for removals

**Example workflow:**

```bash
$ aligntrue revert AGENTS.md

Choose backup to restore:
  2025-11-11T14-30-00-000 - Auto-backup before sync
  2025-11-11T12-15-45-123 - Manual backup

Preview of changes to AGENTS.md:
- ## Security
- Validate all input
+ ## Security
+ Validate all input and sanitize output

Restore "AGENTS.md" from backup 2025-11-11T14-30-00-000? (y/n):
```

### `aligntrue backup cleanup`

Manually clean up old backups:

```bash
# Keep most recent 5 backups
aligntrue backup cleanup --keep 5

# Use config default (keep_count)
aligntrue backup cleanup
```

**Options:**

- `--keep <number>` - Number of backups to keep (default: from config or 10)

**Behavior:**

- Removes oldest backups first
- Requires confirmation before deleting
- Shows count of removed and kept backups

## What gets backed up

**Internal state (always):**

- `.aligntrue/config.yaml` - Configuration
- `.aligntrue/.rules.yaml` - Internal IR
- `.aligntrue/privacy-consent.json` - Privacy settings (if exists)
- Any other files in `.aligntrue/` directory

**Agent files (when enabled):**

- Files matching your `edit_source` configuration (e.g., `AGENTS.md`, `.cursor/rules/*.mdc`)
- Only files you can actually edit are backed up
- Stored in separate `agent-files/` subdirectory within backup
- Ensures you can recover your edits if something goes wrong
- Enabled by default for all sync operations

**Not backed up:**

- `.aligntrue/.cache/` - Cache directory
- `.aligntrue/.backups/` - Backup directory itself
- `.aligntrue/telemetry-events.json` - Telemetry data
- Generated files that can be recreated from IR

## Backup storage

Backups are stored locally in `.aligntrue/.backups/`:

```
.aligntrue/
  .backups/
    2025-10-29T14-30-00-000/
      manifest.json
      config.yaml
      .rules.yaml
    2025-10-29T12-15-45-123/
      manifest.json
      config.yaml
      .rules.yaml
```

### Manifest format

Each backup includes a `manifest.json`:

```json
{
  "version": "1",
  "timestamp": "2025-10-29T14-30-00-000",
  "files": ["config.yaml", ".rules.yaml"],
  "created_by": "manual",
  "notes": "Before experimental changes"
}
```

### Timestamp format

Timestamps use ISO 8601 with millisecond precision, filesystem-safe:

- Format: `YYYY-MM-DDTHH-mm-ss-SSS`
- Example: `2025-10-29T14-30-00-000`
- Original format: `2025-10-29T14:30:00.000Z` (stored in manifest)

## Auto-backup workflow

When `auto_backup: true` and `backup_on` includes the command:

1. **Before operation:** AlignTrue creates timestamped backup
2. **Display:** Shows backup timestamp and restore command
3. **Execute:** Runs requested operation (sync, import, etc.)
4. **After success:** Automatically cleans up old backups based on `keep_count`

**Failure handling:**

- If backup fails: Warning logged, operation continues
- If operation fails: Backups not cleaned up
- If cleanup fails: Silent failure (backups retained)

**Example output:**

```bash
$ aligntrue sync

✔ Creating backup
✔ Backup created: 2025-10-29T14-30-00-000
  Restore with: aligntrue backup restore --to 2025-10-29T14-30-00-000

✔ Syncing to agents
✔ Wrote 3 files

✔ Cleaned up 2 old backups
```

## Use cases

### Solo developer workflow

Manual backups before major changes:

```bash
# Before experimenting with new rules
aligntrue backup create --notes "Before experiment"

# Make changes
aligntrue sync

# If something breaks
aligntrue backup restore
```

### Team workflow with auto-backup

Enable auto-backup for safety:

```yaml
# .aligntrue/config.yaml
backup:
  auto_backup: true
  backup_on: ["sync", "import"]
  keep_count: 20
```

Every sync creates a backup:

```bash
$ aligntrue sync
✔ Backup created: 2025-10-29T14-30-00-000
✔ Syncing to agents
```

### Before major refactoring

Create named backup before big changes:

```bash
aligntrue backup create --notes "Before migrating to new schema"
```

## Troubleshooting

### "No backups found"

If `aligntrue backup list` shows no backups:

- No backups have been created yet
- Run `aligntrue backup create` to create your first backup
- Check `.aligntrue/.backups/` directory exists and has correct permissions

### "Backup restore failed"

If restore fails:

- Original files are preserved (restore is atomic)
- Check backup timestamp is correct with `aligntrue backup list`
- Verify `.aligntrue/` directory has write permissions
- Check disk space is available

### Auto-backup not triggering

If `aligntrue sync` doesn't create backup:

- Check `auto_backup: true` in `.aligntrue/config.yaml`
- Verify `backup_on` array includes `"sync"`
- Not triggered in dry-run mode (`--dry-run`)
- Check logs for backup creation failures

### Too many backups

If backup directory is growing:

- Adjust `keep_count` in config (lower number)
- Run `aligntrue backup cleanup --keep 5` manually
- Auto-cleanup runs after successful operations

### Backup timestamp format

If timestamp looks unfamiliar:

- Filesystem-safe format: `2025-10-29T14-30-00-000`
- Colons and dots replaced with dashes
- ISO 8601 format stored in manifest
- Use exact timestamp from `backup list` for restore

## Integration with other features

### Git workflow

Backups complement but don't replace git:

- **Backups:** Fast rollback for `.aligntrue/` only
- **Git:** Full repository history including exports

Recommended workflow:

```bash
git add .aligntrue/
git commit -m "Update rules"
aligntrue sync  # Auto-backup if enabled
git add .cursor/ AGENTS.md
git commit -m "Sync exports"
```

### Import operations

Enable auto-backup before imports:

```yaml
backup:
  auto_backup: true
  backup_on: ["import"]
```

Import workflow with backup:

```bash
$ aligntrue sync --accept-agent cursor
✔ Backup created: 2025-10-29T14-30-00-000
✔ Importing from cursor
```

### Team mode

Backups are local (not in lockfile):

- Each team member has separate backups
- Not shared via git (`.backups/` should be ignored)
- Useful for individual rollbacks during review

## Performance

Backup operations are fast:

- **Create:** ~10-50ms for typical configs
- **Restore:** ~20-100ms with atomic operation
- **List:** ~5-20ms directory scan
- **Cleanup:** ~5-10ms per backup removed

Storage footprint:

- ~1-5KB per backup (config + rules)
- 10 backups: ~10-50KB
- Negligible compared to `.cache/` or node_modules

## Security

Backup considerations:

- Stored locally in `.aligntrue/.backups/`
- Should be git-ignored (not shared)
- Contains same sensitive data as `.aligntrue/config.yaml`
- No encryption (rely on filesystem permissions)

**Recommended `.gitignore`:**

```gitignore
.aligntrue/.backups/
.aligntrue/.cache/
.aligntrue/telemetry-events.json
```

## See also

- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync operations work
- [Commands reference](/docs/04-reference/cli-reference) - All CLI commands
- [Configuration](/docs/00-getting-started/00-quickstart#configuration) - Config file format
- [Git sources](/docs/04-reference/git-sources) - Using git for rule sharing
