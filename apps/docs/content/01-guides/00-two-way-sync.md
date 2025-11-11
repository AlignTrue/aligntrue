---
title: "Two-way sync"
description: "How two-way sync works: Edit any agent file and changes automatically merge back to IR on next sync."
---

# Two-way sync

By default, AlignTrue enables bidirectional sync between your agent config files and the internal rules (IR). This means you can edit any agent file directly—Cursor, AGENTS.md, VS Code MCP config, etc.—and your changes automatically merge back when you run `aligntrue sync`.

## How it works

When you run `aligntrue sync`:

1. **Detect edited files** - Checks which agent files were modified more recently than the last sync
2. **Merge sections** - Combines sections from all edited files back into the IR
3. **Merge strategy** - Uses last-write-wins: the most recently modified file's version of each section is used
4. **Export to all agents** - Regenerates all agent files from the updated IR

**No prompts. No conflicts. Automatic.**

## Example workflow

### Solo developer

```bash
# 1. Edit your primary rules file
nano AGENTS.md  # Add a new section

# 2. Later, edit in Cursor config
# (via UI or manual edit to .cursor/rules/aligntrue.mdc)

# 3. Sync everything
aligntrue sync
# Output: Detected 2 edited files: AGENTS.md, .cursor/rules/aligntrue.mdc
#         Merged and re-exported to 3 agents
```

What happened:

- Sections from AGENTS.md merged into IR (with most recent version used if both files had edits)
- Both agent files regenerated from the updated IR
- All agents now have consistent rules

### Multiple files edited

If you edit multiple files between syncs:

```
Edit AGENTS.md (10:30 AM)
Edit .cursor/rules/aligntrue.mdc (11:00 AM)
Run aligntrue sync (11:30 AM)

Result: Last-write-wins
- Sections in .cursor/rules/aligntrue.mdc take precedence
- (because it has a newer mtime)
```

**Best practice:** Edit consistently in one file to avoid confusion. Pick `AGENTS.md` for the primary source, or configure a different primary agent in your workflow.

## Disabling two-way sync

To sync **only** IR → agents (no agent file edits detected):

```yaml
# .aligntrue/config.yaml
sync:
  two_way: false
```

Then `aligntrue sync` will only export IR to agent files, ignoring any edits to agent configs.

## Team mode implications

In team mode with lockfile validation:

- Two-way sync **still works** for IR merging
- **But** changes are validated against the lockfile
- Team lead must approve via `aligntrue team approve`
- CI enforces via `aligntrue drift --gates`

Example:

```bash
# Team member edits AGENTS.md
# Run aligntrue sync
# → Detects edit, merges to IR
# → Tries to export but blocked by lockfile validation
# Error: Bundle hash not in allow list (strict mode)
#
# Team lead reviews the change:
aligntrue team approve --current
# Now it exports and the new bundle is approved
```

## Dry-run preview

See what would be merged without writing files:

```bash
aligntrue sync --dry-run
```

Output shows:

- Which agent files would be detected as edited
- What the merged IR would look like
- Which files would be written

## Configuration

The default configuration enables two-way sync:

```yaml
sync:
  two_way: true # Default - enable bidirectional sync
```

No additional configuration needed. When you run `aligntrue sync`, it automatically:

- Detects edited agent files
- Merges them back to IR (last-write-wins)
- Exports to all configured agents

## When to use one-way sync

Set `sync.two_way: false` if you want to:

- Always edit IR directly (`.aligntrue/.rules.yaml`)
- Never allow agent files to feed back changes
- Treat agent files as read-only exports

In this case, `aligntrue sync` only does IR → agents export.

## How merge conflicts are resolved

When multiple agent files have the same section but with different content:

1. Sort by modification time (oldest first)
2. Newest file's version wins (last-write-wins)
3. **No prompts or warnings** - automatic and deterministic

This design prioritizes simplicity and predictability. If you want explicit control over conflicts, use `--dry-run` to review changes before syncing.

## Troubleshooting

### I edited an agent file but don't see changes in other agents

1. Did you run `aligntrue sync`? (two-way sync happens on sync, not continuously)
2. Check if two-way sync is enabled: `aligntrue config get sync.two_way`
3. Verify the agent file exists: `ls -la .cursor/rules/aligntrue.mdc`
4. Check sync output for validation errors

### I edited multiple files and lost some changes

This is last-write-wins behavior:

- File A edited at 10:00 AM
- File B edited at 11:00 AM
- Sections from File B take precedence

**Best practice:** Pick one file as your primary editor. Most teams use `AGENTS.md`.

### Team mode: My changes are blocked after sync

This is expected in strict lockfile mode:

```bash
# Your changes create a new bundle hash
# which isn't approved yet

# Solution: Ask team lead to approve
aligntrue team approve --current
```

## Related pages

- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical details
- [Workflows guide](/docs/01-guides/01-workflows) - Choose your editing workflow
- [Team mode](/docs/03-concepts/team-mode) - Lockfile and governance
