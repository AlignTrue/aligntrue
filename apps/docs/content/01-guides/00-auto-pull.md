# Auto-pull behavior

Auto-pull is a feature that automatically imports changes from your primary agent (like Cursor or AGENTS.md) before syncing rules. This keeps all your agent files in sync when you edit rules in your preferred format.

## How auto-pull works

When you run `aligntrue sync`, the CLI:

1. Checks if auto-pull is enabled in your config
2. Detects if both the primary agent and other agent files have been modified since the last sync
3. If no conflict exists, automatically pulls changes from the primary agent
4. Shows you a brief summary of what changed
5. Proceeds with the normal sync (IR → all agents)

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
- Compares modification times of primary agent and other agent files
- If both have been modified since last sync, shows a conflict prompt

### Conflict resolution strategies

When a conflict is detected, you'll see:

```
⚠ Conflict detected:
  - Primary agent (AGENTS.md) was modified
  - Changes also found in .cursor/rules/aligntrue.mdc

? How would you like to resolve this conflict?
  > Accept changes from primary agent
    Keep other agent changes (skip auto-pull)
    Abort sync and review manually
```

Your choice depends on your configured primary_agent (see [Workflows guide](/docs/01-guides/01-workflows)).

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
  primary_agent: "agents-md" # or "cursor", "claude", etc.
  auto_pull: true # true | false
```

Options:

- `auto_pull: true`: Always accept primary agent changes (default for solo)
- `auto_pull: false`: Always review before syncing (Manual Review mode)
- `primary_agent`: Which agent to pull from during auto-pull

## Choosing your workflow mode

### Decision guide

**Use `auto_pull: false` (Manual Review) if:**

- You want explicit control over when changes sync to all agents
- You're in a team and need to review changes before they deploy
- You want to preview changes with `--dry-run` first
- You prefer explicit confirmation for each sync

**Use `auto_pull: true` (AGENTS.md Primary) if:**

- You're a solo developer and want minimal friction
- You prefer editing in your agent's native format (Cursor, AGENTS.md, etc.)
- You want seamless two-way sync without prompts
- You're migrating from existing agent rules
- Changes should flow automatically to all agents

### Setting your workflow mode

Edit `.aligntrue/config.yaml`:

```yaml
sync:
  primary_agent: "agents-md" # Your preferred editing format
  auto_pull: true # or false for Manual Review
```

Once set, AlignTrue will remember your preference and handle conflicts accordingly.

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

1. **Choose a configuration** (see [Workflows guide](/docs/01-guides/01-workflows))
2. **Edit consistently**: Pick your primary agent and edit there most of the time
3. **Use `--no-auto-pull`** flag when you want to skip auto-pull for one sync

### Missing changes after sync

If you edited an agent file but don't see changes synced to other agents:

1. Check if auto-pull actually ran (look for "Auto-pull from..." message)
2. Verify agent file format is valid (try `aligntrue check`)
3. Look for validation errors in the sync output
4. Check `.aligntrue/.last-sync` timestamp to confirm sync completed
5. Verify the agent is not the primary_agent (primary sources don't auto-pull to themselves)

### Diff not showing

If you don't see the diff summary:

- Check `sync.show_diff_on_pull` is `true` in config
- Verify changes actually occurred (diff only shows if rules changed)
- Use `--show-auto-pull-diff` for full details

## Best practices

1. **Pick one workflow** and stick to it (see [Workflows guide](/docs/01-guides/01-workflows))
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

- [Workflows guide](/docs/01-guides/01-workflows) - Choose between IR-source and native-format workflows
- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical details of sync engine
- [Troubleshooting conflicts](/docs/05-troubleshooting/conflicts) - Detailed conflict resolution
