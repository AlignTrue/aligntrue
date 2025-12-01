---
title: "Backup & restore"
description: "Mandatory automatic backup functionality protects configuration and rules. Backups are created before every destructive operation and cannot be disabled."
---

# Backup & restore

AlignTrue creates automatic backups before every destructive operation to protect your configuration and rules. **Backups are mandatory and cannot be disabled** - this ensures you can always recover from mistakes.

## Safety first

AlignTrue follows a safety-first approach:

1. **Always preview first**: Use `--dry-run` to see what will change
2. **Automatic backups**: Every sync creates a timestamped backup
3. **Easy restore**: Use `aligntrue revert` to undo changes with preview
4. **Age-based retention**: Backups older than 30 days are automatically cleaned up

## Quick start

### Preview before syncing

Always start with dry-run to see changes:

```bash
# Preview what will change (no backup needed)
aligntrue sync --dry-run

# Review output, then sync for real
aligntrue sync
```

### Restore from backup

List available backups:

```bash
aligntrue backup list
```

Restore with preview:

```bash
# Interactive: choose backup and preview changes
aligntrue revert

# Restore specific file with diff preview
aligntrue revert AGENTS.md
```

Restore entire backup:

```bash
# Restore most recent backup
aligntrue backup restore

# Restore specific backup
aligntrue backup restore --to 2025-11-18T14-30-00-000
```

## Configuration

Backups are mandatory. You can only control **retention** (how old backups can be):

```yaml
# .aligntrue/config.yaml
backup:
  retention_days: 30 # Age-based cleanup: 0 = manual only, default: 30
  minimum_keep: 3 # Safety floor: always keep N most recent
```

**Configuration options:**

- **`retention_days`** (number): How many days to keep backups
  - Default: 30
  - Minimum: 0 (manual cleanup only)
  - No maximum
  - Backups older than this are automatically deleted after sync
- **`minimum_keep`** (number): Safety floor for recent backups
  - Default: 3
  - Minimum: 1
  - Even if backup is older than `retention_days`, keep at least this many most recent backups
  - Protects against accidental over-cleanup if syncing infrequently

**Deprecated (still supported for migration):**

- **`keep_count`** (number): Old count-based retention, now replaced by `retention_days`
  - No longer used if `retention_days` is set
  - Kept for backward compatibility with existing configs

**What you cannot configure:**

- Backups cannot be disabled (safety requirement)
- All destructive operations create backups automatically
- No way to skip backup creation

## CLI commands

### `aligntrue sync`

Every sync creates a backup automatically:

```bash
$ aligntrue sync

✔ Creating safety backup
✔ Safety backup created: 2025-11-18T14-30-00-000
✔ Syncing to agents
✔ Wrote 3 files
```

To restore:

```bash
aligntrue backup restore --to 2025-11-18T14-30-00-000
```

### `aligntrue backup create`

Create manual backup anytime:

```bash
# Basic backup
aligntrue backup create

# With notes for later reference
aligntrue backup create --notes "Before experimental changes"
```

**Output:**

```
✔ Backup created
  Backup: 2025-11-18T14-30-00-000
  Notes: Before experimental changes
  Files: 3 backed up
  Location: /path/to/.aligntrue/.backups/2025-11-18T14-30-00-000
```

### `aligntrue backup list`

List all available backups:

```bash
aligntrue backup list
```

**Example output:**

```
Found 5 backups:

  2025-11-18T14-30-00-000
    Created: 11/18/2025, 2:30:00 PM
    By: sync
    Files: 3

  2025-11-18T12-15-45-123
    Created: 11/18/2025, 12:15:45 PM
    By: manual
    Files: 3
    Notes: Before experimental changes
```

### `aligntrue revert`

Restore files with preview (recommended):

```bash
# Interactive: choose backup and preview changes
aligntrue revert

# Restore specific file with diff preview
aligntrue revert AGENTS.md

# Restore from specific backup
aligntrue revert --timestamp 2025-11-18T14-30-00-000

# Skip confirmation (use with caution)
aligntrue revert AGENTS.md -y
```

**Features:**

- **Interactive selection** - Choose from available backups
- **Diff preview** - See exactly what will change before restoring
- **Selective restore** - Restore single files instead of full backup
- **Colored diff** - Green for additions, red for removals

**Example workflow:**

```bash
$ aligntrue revert AGENTS.md

Choose backup to restore:
  2025-11-18T14-30-00-000 - sync
  2025-11-18T12-15-45-123 - manual

Preview of changes to AGENTS.md:
- ## Security
- Validate all input
+ ## Security
+ Validate all input and sanitize output

Restore "AGENTS.md" from backup 2025-11-18T14-30-00-000? (y/n):
```

### `aligntrue backup restore`

Restore entire backup atomically:

```bash
# Restore most recent backup
aligntrue backup restore

# Restore specific backup by timestamp
aligntrue backup restore --to 2025-11-18T14-30-00-000
```

**Behavior:**

- Creates temporary backup before restore (safety net)
- Atomically restores all files from backup
- Rolls back to temporary backup if restore fails
- Cleans up temporary backup on success

**Warning:** This overwrites current `.aligntrue/` directory contents. Use `aligntrue revert` for preview and selective restore.

### `aligntrue backup cleanup`

Manually trigger cleanup:

```bash
# Clean up backups older than configured retention_days
aligntrue backup cleanup

**Automatic cleanup:**

After every successful sync, AlignTrue automatically cleans up old backups based on your `retention_days` setting. Manual cleanup is rarely needed.

## What gets backed up

**Internal state (always):**

- `.aligntrue/config.yaml` - Configuration
- `.aligntrue/rules` - Internal IR
- `.aligntrue/privacy-consent.json` - Privacy settings (if exists)
- Any other files in `.aligntrue/` directory

**Agent files (included by default):**

Backups include agent export files based on your configured exporters:

- `AGENTS.md` - Universal agent format
- `.cursor/rules/*.mdc` - Cursor rules
- `CLAUDE.md`, `GEMINI.md`, etc. - Agent-specific formats
- `.clinerules/*.md`, `.amazonq/rules/*.md`, etc. - Multi-file formats
- Any other files written by configured exporters

This ensures you can recover your complete agent setup if something goes wrong.

**Not backed up:**

- `.aligntrue/.cache/` - Cache directory
- `.aligntrue/.backups/` - Backup directory itself
- `.aligntrue/telemetry-events.json` - Telemetry data
- Files not written by configured exporters

## Backup storage

Backups are stored locally in `.aligntrue/.backups/`:

```

.aligntrue/
.backups/
2025-11-18T14-30-00-000/
manifest.json
config.yaml
.rules.yaml
agent-files/
AGENTS.md
.cursor/rules/rule1.mdc
.cursor/rules/rule2.mdc
2025-11-18T12-15-45-123/
manifest.json
config.yaml
.rules.yaml

````

### Manifest format

Each backup includes a `manifest.json`:

```json
{
  "version": "1",
  "timestamp": "2025-11-18T14-30-00-000",
  "files": ["config.yaml", "rules"],
  "agent_files": [
    "AGENTS.md",
    ".cursor/rules/rule1.mdc",
    ".cursor/rules/rule2.mdc"
  ],
  "created_by": "sync",
  "action": "pre-sync",
  "mode": "solo"
}
````

### Timestamp format

Timestamps use ISO 8601 with millisecond precision, plus uniqueness guarantees:

- Format: `YYYY-MM-DDTHH-mm-ss-SSS-PID-SEQ`
- Example: `2025-11-18T14-30-00-000-1a2b-1`
- Components:
  - Date and time with milliseconds (filesystem-safe)
  - Process ID in base36 (4-6 characters)
  - Sequence number in base36 (increments per backup)
- Original ISO format: `2025-11-18T14:30:00.000Z` (stored in manifest)

### Concurrent operation safety

Backups are guaranteed unique even during concurrent operations:

- **Process ID suffix**: Ensures uniqueness across parallel processes
- **Sequence counter**: Prevents collisions within same process
- **No locking overhead**: Lock-free design for performance
- **Timestamp sortability**: Maintains chronological order

This design handles:

- Multiple concurrent `aligntrue sync` operations
- Rapid successive backup creation
- Clock drift and virtualization edge cases
- High-frequency automation workflows

## Safety best practices

### 1. Always dry-run first

Preview changes before applying them:

```bash
# See what will change
aligntrue sync --dry-run

# Review output carefully
# Then sync for real
aligntrue sync
```

### 2. Know how to revert

Before making major changes, practice reverting:

```bash
# List available backups
aligntrue backup list

# Practice restoring a single file
aligntrue revert AGENTS.md

# Cancel when you see the preview
```

### 3. Understand backup retention

Keep enough backups for your workflow using age-based retention:

```yaml
# Default retention (30 days, keep at least 3 recent)
backup:
  retention_days: 30
  minimum_keep: 3

# Longer retention (90 days for infrequent syncs)
backup:
  retention_days: 90
  minimum_keep: 5

# Aggressive cleanup (7 days, but always keep last 2)
backup:
  retention_days: 7
  minimum_keep: 2
```

**When to increase `retention_days`:**

- Infrequent syncing (less than weekly)
- Need longer rollback history
- Experimentation with major changes

**When to decrease `retention_days`:**

- Disk space constraints
- Frequent syncing (multiple times per day)
- Minimal rollback needs

**`minimum_keep` safety floor:**

- Always preserves at least this many most recent backups
- Protects against accidental over-cleanup with old backups
- Default (3) good for most users, increase if syncing very infrequently

### 4. Use manual backups for major changes

Before big refactoring, create named backup:

```bash
aligntrue backup create --notes "Before schema migration v2"
```

This helps you identify important restore points later.

### 5. Check backup before risky operations

Before deleting rules or major edits:

```bash
# Verify recent backup exists
aligntrue backup list

# Create fresh backup with notes
aligntrue backup create --notes "Before deleting old rules"

# Proceed with changes
```

## Use cases

### Solo developer workflow

```bash
# Start with preview
aligntrue sync --dry-run

# Review changes, then sync
aligntrue sync
# ✔ Safety backup created: 2025-11-18T14-30-00-000

# Make some edits...
vim AGENTS.md

# Sync again (another backup created automatically)
aligntrue sync
# ✔ Safety backup created: 2025-11-18T15-00-00-000

# Oops, made a mistake - restore previous version
aligntrue revert AGENTS.md --timestamp 2025-11-18T14-30-00-000
```

### Team workflow

Git provides primary history, backups provide fast local rollback:

```bash
# Pull latest team rules
git pull origin main

# Sync to agents (automatic backup)
aligntrue sync
# ✔ Safety backup created: 2025-11-18T14-30-00-000

# Make personal edits
vim AGENTS.md

# Preview before syncing
aligntrue sync --dry-run

# Looks good, sync for real
aligntrue sync
# ✔ Safety backup created: 2025-11-18T14-45-00-000

# Commit both IR and exports
git add .aligntrue/ AGENTS.md .cursor/
git commit -m "Update personal rules"
```

### Before major refactoring

```bash
# Create named backup
aligntrue backup create --notes "Before migrating to new schema"

# Make changes
# ...edit files...

# Preview impact
aligntrue sync --dry-run

# Sync if okay
aligntrue sync

# If something breaks
aligntrue backup list
aligntrue backup restore --to <timestamp-before-refactor>
```

## Troubleshooting

### "No backups found"

If `aligntrue backup list` shows no backups:

- No destructive operations have been run yet
- Run `aligntrue sync` to create first automatic backup
- Or run `aligntrue backup create` for manual backup
- Check `.aligntrue/.backups/` directory exists

### Backup restore failed

If restore fails:

- Original files are preserved (restore is atomic)
- Check backup timestamp is correct with `aligntrue backup list`
- Verify `.aligntrue/` directory has write permissions
- Check disk space is available
- Use `aligntrue revert` for selective restore with preview

### Too many backups

Backups are cleaned up automatically after each sync based on `retention_days` and `minimum_keep`.

To adjust retention permanently:

```yaml
backup:
  retention_days: 60 # Keep backups for 60 days instead of 30 (default)
  minimum_keep: 5 # Always keep at least 5 most recent backups (default: 3)
```

## Integration with other features

### Git workflow

Backups complement but don't replace git:

- **Backups:** Fast local rollback for `.aligntrue/` and agent files
- **Git:** Full repository history including all files

Recommended workflow:

```bash
# Sync creates automatic backup
aligntrue sync

# Commit both IR and exports
git add .aligntrue/ .cursor/ AGENTS.md
git commit -m "Update rules"
git push
```

### Team mode

Backups are local (not in lockfile):

- Each team member has separate backups
- Not shared via git (`.aligntrue/.backups/` is git-ignored by default)
- Useful for individual rollbacks during review
- Team rules tracked via git, backups provide local safety net

## Performance

Backup operations are fast:

- **Create:** ~10-50ms for typical configs
- **Restore:** ~20-100ms with atomic operation
- **List:** ~5-20ms directory scan
- **Cleanup:** ~5-10ms per backup removed

Storage footprint:

- ~2-10KB per backup (config + rules + agent files)
- 20 backups (default): ~40-200KB
- Negligible compared to `.cache/` or node_modules

## Security

Backup considerations:

- Stored locally in `.aligntrue/.backups/`
- Should be git-ignored (not shared)
- Contains same data as `.aligntrue/` and agent files
- No encryption (rely on filesystem permissions)
- Automatic cleanup prevents unbounded storage

**Recommended `.gitignore`:**

```gitignore
.aligntrue/.backups/
.aligntrue/.cache/
.aligntrue/telemetry-events.json
.aligntrue/privacy-consent.json
```

## See also

- [Safety Best Practices](/docs/01-guides/09-safety-best-practices) - Comprehensive safety guide
- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync operations work
- [Commands reference](/docs/04-reference/cli-reference) - All CLI commands
- [Configuration](/docs/00-getting-started/00-quickstart#configuration) - Config file format
