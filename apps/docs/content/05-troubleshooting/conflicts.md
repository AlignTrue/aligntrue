# Resolving conflicts

Conflicts occur when both your rules.md and agent files have been modified since the last sync. This guide helps you understand and resolve them effectively.

## Understanding conflicts

### What triggers a conflict

A conflict is detected when:

1. You run `aligntrue sync`
2. Auto-pull is enabled
3. Both files have been modified since `.aligntrue/.last-sync` timestamp
4. AlignTrue doesn't know which change to keep

### What conflicts look like

```
⚠ Conflict detected:
  - You edited .aligntrue/rules.md
  - Changes also found in .cursor/rules/aligntrue.mdc

? How would you like to resolve this conflict?
  > Keep my edits to rules.md (skip auto-pull)
    Accept changes from cursor
    Abort sync and review manually
```

## Resolution strategies

### 1. Keep IR edits (skip auto-pull)

**When to use:**

- You manually edited rules.md
- Your rules.md changes are more important
- You want to preserve your work

**What happens:**

- Auto-pull is skipped
- Your rules.md edits are kept
- Sync proceeds IR → agents (your changes overwrite agent files)

```bash
# Or use flag to skip auto-pull entirely
aligntrue sync --no-auto-pull
```

### 2. Accept agent changes

**When to use:**

- Agent file edits are more recent or important
- You want to pull those changes into rules.md
- You're okay with rules.md being overwritten

**What happens:**

- Agent changes are pulled into rules.md
- Your rules.md edits are overwritten
- Sync proceeds normally

**Note:** Consider backing up first if your rules.md edits matter.

### 3. Abort and review manually

**When to use:**

- You're unsure which changes to keep
- You want to merge changes manually
- You need to back up current state first

**What happens:**

- Sync exits without making changes
- You can review both files
- You can manually merge or choose a resolution

## Manual conflict resolution

### Step 1: Back up current state

```bash
aligntrue backup create --notes "Before manual conflict resolution"
```

### Step 2: Review changes

Compare the two files:

```bash
# View rules.md
cat .aligntrue/rules.md

# View agent file (example: Cursor)
cat .cursor/rules/aligntrue.mdc

# Or use diff tool
diff .aligntrue/rules.md <(aligntrue export cursor --dry-run)
```

### Step 3: Choose resolution

**Option A: Keep rules.md, discard agent changes**

```bash
aligntrue sync --no-auto-pull
```

**Option B: Keep agent changes, discard rules.md**

```bash
aligntrue sync --accept-agent cursor
```

**Option C: Merge manually**

1. Edit rules.md to include both changes
2. Run sync without auto-pull:
   ```bash
   aligntrue sync --no-auto-pull
   ```

### Step 4: Verify

```bash
# Check that sync completed
aligntrue check

# Review exported files
cat .cursor/rules/aligntrue.mdc
```

## Preventing conflicts

### 1. Choose a workflow mode

The best way to prevent conflicts is to set a workflow mode:

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "native_format" # or "ir_source"
```

See [Workflows guide](/docs/01-guides/01-workflows) for details.

### 2. Edit only one source

**IR-source workflow:**

- Edit: `.aligntrue/rules.md`
- Don't edit: Agent files
- Pull manually: `aligntrue sync --accept-agent cursor`

**Native-format workflow:**

- Edit: Agent files (`.cursor/rules/*.mdc`)
- Don't edit: `.aligntrue/rules.md`
- Let auto-pull handle it

### 3. Sync frequently

Run `aligntrue sync` often to keep files in sync:

```bash
# After editing rules
vim .aligntrue/rules.md
aligntrue sync

# After editing agent files (if native-format workflow)
# Edit in Cursor...
aligntrue sync
```

### 4. Use file watchers (advanced)

See [File watcher setup](/docs/04-reference/file-watcher-setup) for automatic sync on file changes.

## Common conflict scenarios

### Scenario 1: Accidentally edited both files

**Problem:**
You edited rules.md, then forgot and also edited Cursor rules.

**Solution:**

1. Check timestamps to see which is more recent
2. Choose the more recent edit
3. Set workflow mode to prevent future accidents

```bash
ls -la .aligntrue/rules.md
ls -la .cursor/rules/aligntrue.mdc

# Keep newer file's changes
aligntrue sync --accept-agent cursor  # if agent is newer
aligntrue sync --no-auto-pull         # if rules.md is newer
```

### Scenario 2: Team member pushed rules.md changes

**Problem:**
You pulled from git, rules.md changed, but your agent file is different.

**Solution:**
Accept the team's rules.md changes:

```bash
git pull
aligntrue sync --no-auto-pull  # Push rules.md to agents
```

### Scenario 3: Experimented in agent, want to keep some changes

**Problem:**
You tested multiple rule variations in Cursor, want to keep some but not all.

**Solution:**

1. Back up current state
2. Manually edit rules.md to include desired changes
3. Sync without auto-pull

```bash
aligntrue backup create
vim .aligntrue/rules.md  # Add desired rules from agent
aligntrue sync --no-auto-pull
```

### Scenario 4: Conflict after long gap between syncs

**Problem:**
Haven't synced in days, both files diverged significantly.

**Solution:**

1. Review both files carefully
2. Back up before resolving
3. Consider manual merge
4. Sync more frequently going forward

```bash
aligntrue backup create
diff .aligntrue/rules.md .cursor/rules/aligntrue.mdc
# Manually merge in your editor
aligntrue sync --no-auto-pull
```

## Advanced resolution

### Three-way merge (manual)

For complex conflicts, use git-style three-way merge:

1. Get the last synced version (from backup)
2. Compare all three versions
3. Merge changes manually

```bash
# Get last clean state
aligntrue backup list
aligntrue backup restore --to <timestamp> --destination /tmp/last-clean

# Compare
diff3 .aligntrue/rules.md /tmp/last-clean/rules.md .cursor/rules/aligntrue.mdc

# Manually resolve in editor
vim .aligntrue/rules.md

# Sync
aligntrue sync --no-auto-pull
```

### Scripted resolution

For teams with specific conflict policies:

```bash
#!/bin/bash
# always-prefer-rules-md.sh

# Always keep rules.md changes, never auto-pull
aligntrue sync --no-auto-pull
```

Add to git hooks or CI to enforce policy.

## Conflict logs

### Check sync history

```bash
# View last sync timestamp
cat .aligntrue/.last-sync

# View backup history
aligntrue backup list

# View config
cat .aligntrue/config.yaml
```

### Debug mode

Get detailed sync information:

```bash
ALIGNTRUE_DEBUG=1 aligntrue sync --dry-run
```

## Recovery from bad resolution

### If you chose wrong option

1. Restore from backup:

   ```bash
   aligntrue backup list
   aligntrue backup restore --to <timestamp>
   ```

2. Try again:
   ```bash
   aligntrue sync  # Choose correct option this time
   ```

### If auto-backup disabled

If you didn't have backups enabled:

1. Check git history:

   ```bash
   git log -p .aligntrue/rules.md
   git checkout HEAD~1 .aligntrue/rules.md
   ```

2. If agent file matters:
   Some agents keep history (check `.cursor/` directory)

3. Manual reconstruction from memory

## Best practices

1. **Enable auto-backup:**

   ```yaml
   backup:
     auto_backup: true
     backup_on: ["sync"]
   ```

2. **Use version control:**
   Commit rules.md regularly

3. **Set workflow mode:**
   Avoid conflicts by choosing one editing location

4. **Sync frequently:**
   Small, frequent syncs are easier than big merges

5. **Review diffs:**
   Use `--show-auto-pull-diff` to see what changed

6. **Test in dry-run:**
   Use `--dry-run` before actual sync

## Related pages

- [Auto-pull behavior](/docs/01-guides/00-auto-pull) - Understanding auto-pull
- [Workflows guide](/docs/01-guides/01-workflows) - Choosing your workflow
- [Backup and restore](/docs/04-reference/backup-restore) - Using backups
- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync works
