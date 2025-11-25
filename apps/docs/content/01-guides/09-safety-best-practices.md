---
title: "Safety best practices"
description: "Comprehensive guide to using AlignTrue safely with dry-run workflows, automatic backups, and recovery procedures."
---

# Safety best practices

AlignTrue follows a safety-first design with automatic backups, dry-run previews, and easy recovery. This guide shows you how to use these features effectively.

## Core safety principles

1. **Preview before applying**: Always use `--dry-run` first
2. **Automatic protection**: Backups created before every sync (mandatory)
3. **Easy recovery**: `aligntrue revert` for quick rollback with preview
4. **Retention control**: Keep 10-100 backups based on your workflow

## The dry-run workflow

### Always start with preview

Before any sync, see what will change:

```bash
# Step 1: Preview (no changes, no backup needed)
aligntrue sync --dry-run

# Step 2: Review output carefully
# - Which files will change?
# - Are the changes expected?
# - Any warnings or errors?

# Step 3: Sync for real
aligntrue sync
```

### What dry-run shows you

```bash
$ aligntrue sync --dry-run

Previewing changes (dry-run mode)

Files that would be written:
  .cursor/rules/rule1.mdc
  .cursor/rules/rule2.mdc
  AGENTS.md

Changes preview:
  - 2 sections updated
  - 1 section added

No files were modified (dry-run)
```

### When to skip dry-run

You might skip dry-run when:

- Rules haven't changed
- Just ran dry-run seconds ago
- Emergency rollback needed
- Confident in change (your call)

But when in doubt, dry-run.

## Understanding automatic backups

### Backups are mandatory

AlignTrue **always** creates backups before destructive operations:

```bash
$ aligntrue sync

✔ Creating safety backup
✔ Safety backup created: 2025-11-18T14-30-00-000
✔ Syncing to agents
✔ Wrote 3 files
```

You cannot disable this. It's a core safety feature.

### What gets backed up

**Every sync backs up:**

- `.aligntrue/` directory (config, rules, etc.)
- Agent files you can edit (AGENTS.md, .cursor/, etc.)
- All metadata and settings

**Not backed up:**

- Cache files
- Telemetry data
- Files that can be regenerated

### Overwritten rules safety (file-level)

Before any file is overwritten, AlignTrue automatically backs up manually edited content:

- **Location**: `.aligntrue/overwritten-rules/` directory
- **Format**: Timestamped copies preserving original path structure
- **Example**: `.cursor/rules/rule1.mdc` → `.aligntrue/overwritten-rules/cursor/rules/rule1.2025-01-15T14-30-00.mdc`
- **When**: Before overwriting files that were manually edited since last sync
- **Review**: You can review and delete backups anytime

**Two-tier safety:**

1. Auto-backup (entire workspace before sync)
2. Overwritten-rules backup (individual files before overwriting)
3. Section-level backup (for conflicting sections during merge)

Multiple layers ensure you never lose work.

### Backup retention

Control how many backups to keep:

```yaml
# .aligntrue/config.yaml
backup:
  keep_count: 20 # Min: 10, Default: 20, Max: 100
```

**Automatic cleanup:**

After each successful sync, AlignTrue automatically removes oldest backups beyond your `keep_count`.

### Checking your backups

```bash
# List all backups
aligntrue backup list

# See what's in a specific backup
aligntrue revert --timestamp 2025-11-18T14-30-00-000
# (cancel when you see the preview)
```

## Recovery workflows

### Quick recovery with revert

`aligntrue revert` is your main recovery tool:

```bash
# Interactive: choose backup, preview changes
aligntrue revert

# Restore specific file with preview
aligntrue revert AGENTS.md

# Restore from specific backup
aligntrue revert --timestamp 2025-11-18T14-30-00-000
```

**Why use revert:**

- See exact changes before restoring
- Restore single files instead of everything
- Interactive and safe
- Colored diff for clarity

**Example session:**

```bash
$ aligntrue revert AGENTS.md

Choose backup to restore:
  2025-11-18T14-30-00-000 - sync
  2025-11-18T12-15-45-123 - manual

Preview of changes to AGENTS.md:
- ## Testing rules
- Test before committing
+ ## Testing
+ Always write tests first

Restore "AGENTS.md" from backup? (y/n): y

✔ Restored AGENTS.md
```

### Full backup restore

For complete rollback:

```bash
# List backups to find timestamp
aligntrue backup list

# Restore entire backup
aligntrue backup restore --to 2025-11-18T14-30-00-000
```

**When to use full restore:**

- Multiple files need rollback
- Want exact state from backup
- Recovering from major mistake
- Config changes went wrong

**Safety features:**

- Creates temporary backup before restore
- Atomic operation (all or nothing)
- Rolls back if restore fails
- Shows confirmation before proceeding

### Creating safety checkpoints

Before major changes:

```bash
# Create named backup
aligntrue backup create --notes "Before schema migration"

# Make your changes
# ...

# If something breaks
aligntrue backup list
aligntrue backup restore --to <your-checkpoint-timestamp>
```

## Safe editing workflows

### Solo developer

```bash
# 1. Check current state
aligntrue status

# 2. Preview changes
aligntrue sync --dry-run

# 3. Sync (automatic backup)
aligntrue sync

# 4. Edit agent file
vim AGENTS.md

# 5. Preview again
aligntrue sync --dry-run

# 6. Sync again (another automatic backup)
aligntrue sync

# 7. If mistake, restore
aligntrue revert AGENTS.md
```

### Team mode

```bash
# 1. Pull latest team rules
git pull origin main

# 2. Preview before sync
aligntrue sync --dry-run

# 3. Sync to agents (automatic backup)
aligntrue sync

# 4. Make personal edits
vim AGENTS.md

# 5. Preview before sync
aligntrue sync --dry-run

# 6. Sync (automatic backup)
aligntrue sync

# 7. Commit to git
git add .aligntrue/ AGENTS.md .cursor/
git commit -m "Update personal rules"
```

### Experimenting safely

```bash
# 1. Create checkpoint
aligntrue backup create --notes "Before experiment"

# 2. Try your idea
vim AGENTS.md
aligntrue sync --dry-run
aligntrue sync

# 3. Test it
# ...

# 4a. Keep changes (do nothing)
# 4b. Rollback experiment
aligntrue backup list
aligntrue backup restore --to <experiment-checkpoint>
```

## Managing backup retention

### Choosing keep_count

**10 backups (minimum):**

- Casual use
- Infrequent syncs
- Tight disk space

**20 backups (default):**

- Regular development
- Daily syncs
- Good balance

**50+ backups:**

- Frequent syncs
- Active experimentation
- Want long history

### Adjusting retention

```yaml
# .aligntrue/config.yaml
backup:
  keep_count: 30
```

Then sync to apply:

```bash
aligntrue sync
```

### Manual cleanup

Remove old backups immediately:

```bash
# Keep only 15 most recent
aligntrue backup cleanup --keep 15
```

### Storage considerations

Typical backup sizes:

- Small config: ~2-5KB per backup
- Medium config: ~5-10KB per backup
- Large config: ~10-50KB per backup

With 20 backups at ~5KB each = ~100KB total. Negligible.

## Error recovery

### Sync failed partway

If sync fails, your backup is intact:

```bash
$ aligntrue sync

✔ Safety backup created: 2025-11-18T14-30-00-000
✔ Syncing to agents
✗ Error writing .cursor/rules/rule1.mdc

# Your files are unchanged
# Backup is available if needed
```

Fix the error and try again. Previous backup still available.

### Wrong changes applied

```bash
# Undo specific file
aligntrue revert AGENTS.md

# Or full rollback
aligntrue backup restore
```

### Backup system failed

If backup creation fails (rare):

```bash
$ aligntrue sync

⚠ Failed to create safety backup: Disk full
⚠ Continuing with sync (unsafe)...
```

**Fix immediately:**

1. Free up disk space
2. Run `aligntrue backup create` to verify backup system works
3. Then proceed with syncs

### Corrupted config

If config is damaged:

```bash
# Restore from backup
aligntrue backup restore

# Or restore just config
aligntrue revert .aligntrue/config.yaml
```

## Advanced patterns

### Before major refactoring

```bash
# Create named checkpoint
aligntrue backup create --notes "Stable state before refactor"

# Note the timestamp
aligntrue backup list

# Make changes incrementally
# After each step:
aligntrue sync --dry-run
aligntrue sync

# If any step breaks things
aligntrue backup restore --to <stable-timestamp>
```

### Testing new exporters

```bash
# Checkpoint before enabling
aligntrue backup create --notes "Before adding copilot exporter"

# Add exporter to config
vim .aligntrue/config.yaml

# Test with dry-run
aligntrue sync --dry-run

# If output looks good
aligntrue sync

# If something's wrong
aligntrue backup restore
```

### Recovering from git conflicts

```bash
# After messy git merge
git status
# shows conflicts in .aligntrue/

# Restore known-good state
aligntrue backup list
aligntrue backup restore --to <before-merge>

# Retry merge more carefully
git merge --abort
# ... handle conflicts properly ...
```

## Safety checklist

### Before every sync

- [ ] Run `aligntrue sync --dry-run` first
- [ ] Review what files will change
- [ ] Check for unexpected changes
- [ ] Note any warnings or errors
- [ ] Understand why changes are happening

### Before major changes

- [ ] Create named backup with `--notes`
- [ ] Note the backup timestamp
- [ ] Test with `--dry-run` first
- [ ] Apply changes incrementally
- [ ] Verify each step before continuing

### After problems

- [ ] Check `aligntrue backup list`
- [ ] Use `aligntrue revert` for single files
- [ ] Use `backup restore` for full rollback
- [ ] Understand what went wrong
- [ ] Fix root cause before retrying

## Common mistakes

### Skipping dry-run

**Problem:**

```bash
# Danger: syncing without preview
aligntrue sync
```

**Better:**

```bash
# Safe: preview first
aligntrue sync --dry-run
aligntrue sync
```

### Not checking backups

**Problem:**

Making changes without knowing you have backups.

**Better:**

```bash
# Verify backups exist
aligntrue backup list

# See what's backed up
aligntrue revert --timestamp <latest>
# (cancel after preview)
```

### Disabling backups

**Not possible:** Backups are mandatory. If you found a way to disable them, that's a bug.

### Too few backups

**Problem:**

```yaml
backup:
  keep_count: 5 # Error: minimum is 10
```

**Better:**

```yaml
backup:
  keep_count: 20 # Default, good for most users
```

### Ignoring warnings

**Problem:**

```bash
$ aligntrue sync
⚠ Failed to create safety backup
⚠ Continuing with sync (unsafe)...
```

Don't ignore this. Fix the backup system.

**Better:**

```bash
# Stop and fix
# Check disk space
df -h

# Verify backup system
aligntrue backup create

# Then proceed
aligntrue sync
```

## Integration with git

### Backups vs git

**Backups:**

- Fast local rollback
- Only `.aligntrue/` and agent files
- Not shared with team
- Automatic before every sync

**Git:**

- Full repository history
- All files tracked
- Shared with team
- Manual commits

Use both:

```bash
# Sync creates local backup
aligntrue sync

# Git tracks everything
git add .
git commit -m "Update rules"
git push
```

### Recovery priority

1. **Immediate rollback**: Use `aligntrue revert` (fast, local)
2. **Recent changes**: Use `aligntrue backup restore` (fast, local)
3. **Older changes**: Use `git log` and `git checkout` (full history)
4. **Team coordination**: Use git (shared, reviewable)

## See also

- [Backup & restore reference](/docs/04-reference/backup-restore) - Full command documentation
- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync works
- [Team-managed sections](/docs/01-guides/08-team-managed-sections) - Team collaboration guide
- [Configuration reference](/docs/04-reference/config-reference) - All config options
