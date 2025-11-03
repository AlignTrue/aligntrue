# Auto-pull behavior

Auto-pull is a feature that automatically imports changes from your primary agent (like Cursor) before syncing rules. This keeps your rules.md file in sync with any edits made directly to agent configuration files.

## How auto-pull works

When you run `aligntrue sync`, the CLI:

1. Checks if auto-pull is enabled in your config
2. Detects if both rules.md and your agent files have been modified since the last sync
3. If no conflict exists, automatically pulls changes from the agent
4. Shows you a brief summary of what changed
5. Proceeds with the normal sync (IR → agents)

## When auto-pull runs

Auto-pull runs automatically when:

- `sync.auto_pull` is `true` in your config (default for solo mode)
- You haven't used the `--no-auto-pull` flag
- You haven't manually specified `--accept-agent`
- A primary agent is configured (usually auto-detected)
- The agent's file exists and is importable

## Conflict detection

AlignTrue uses timestamp-based conflict detection to prevent data loss:

- Stores the last sync timestamp in `.aligntrue/.last-sync`
- Compares modification times of rules.md and agent files
- If both have been modified since last sync, shows a conflict prompt

### Conflict resolution strategies

When a conflict is detected, you'll see:

```
⚠ Conflict detected:
  - You edited .aligntrue/rules.md
  - Changes also found in .cursor/rules/aligntrue.mdc

? How would you like to resolve this conflict?
  > Keep my edits to rules.md (skip auto-pull)
    Accept changes from cursor
    Abort sync and review manually
```

Your choice depends on your workflow mode (see [Workflows guide](/guides/workflows)).

## Configuration

### Enable/disable auto-pull

In `.aligntrue/config.yaml`:

```yaml
sync:
  auto_pull: true # Enable (default for solo mode)
  primary_agent: "cursor" # Agent to pull from
  on_conflict: "prompt" # How to handle conflicts
```

### Workflow modes

Set your preferred workflow to avoid conflict prompts:

```yaml
sync:
  workflow_mode: "native_format" # auto | ir_source | native_format
```

Modes:

- `auto`: Prompt on each conflict (default)
- `ir_source`: Always keep rules.md edits, never auto-pull
- `native_format`: Always accept agent changes, auto-pull enabled

### Show diff summaries

Control whether you see what changed during auto-pull:

```yaml
sync:
  show_diff_on_pull: true # Show brief summary (default)
```

Or use the flag for full details:

```bash
aligntrue sync --show-auto-pull-diff
```

## CLI flags

### Disable auto-pull for one sync

```bash
aligntrue sync --no-auto-pull
```

This skips auto-pull even if it's enabled in your config. Useful when you want explicit control over the sync direction.

### Show full diff

```bash
aligntrue sync --show-auto-pull-diff
```

Shows detailed diff of all changes pulled from the agent, including:

- Complete list of added, modified, and removed rules
- Specific changes for each modified rule (severity, guidance, tags, etc.)
- Rule previews with guidance snippets

## Troubleshooting

### Auto-pull not running

Check:

1. Is `sync.auto_pull: true` in your config?
2. Is `primary_agent` set (check with `aligntrue config get sync.primary_agent`)?
3. Did you use `--no-auto-pull` flag?
4. Does the agent file exist (e.g., `.cursor/rules/aligntrue.mdc`)?

### Conflicts every time

This happens when both files are modified between syncs. Solutions:

1. **Choose a workflow mode** to avoid prompts (see [Workflows guide](/guides/workflows))
2. **Edit only one source**: Either rules.md OR agent files, not both
3. **Use `--no-auto-pull`** when you know you've edited rules.md manually

### Missing changes after sync

If you edited an agent file but don't see changes in rules.md:

1. Check if auto-pull actually ran (look for "Auto-pull from..." message)
2. Verify agent file format is valid (try `aligntrue check`)
3. Look for validation errors in the sync output
4. Check `.aligntrue/.last-sync` timestamp to confirm sync completed

### Diff not showing

If you don't see the diff summary:

- Check `sync.show_diff_on_pull` is `true` in config
- Verify changes actually occurred (diff only shows if rules changed)
- Use `--show-auto-pull-diff` for full details

## Best practices

1. **Pick one workflow** and stick to it (see [Workflows guide](/guides/workflows))
2. **Configure workflow mode** on first use to avoid conflict prompts
3. **Review diffs** to understand what changed
4. **Use version control** to track rule evolution over time
5. **Test in dry-run** first if unsure: `aligntrue sync --dry-run`

## State files

Auto-pull uses these files:

- `.aligntrue/.last-sync` - Timestamp of last successful sync
- `.aligntrue/.workflow-configured` - Marker that workflow choice was made
- `.aligntrue/config.yaml` - Auto-pull settings

These files should be in `.gitignore` for solo mode, but committed in team mode.

## Related pages

- [Workflows guide](/guides/workflows) - Choose between IR-source and native-format workflows
- [Sync behavior](/concepts/sync-behavior) - Technical details of sync engine
- [Troubleshooting conflicts](/troubleshooting/conflicts) - Detailed conflict resolution
