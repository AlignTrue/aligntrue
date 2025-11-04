# Choosing your workflow

AlignTrue supports two primary editing workflows. Understanding which one fits your style will help you avoid conflicts and work more efficiently.

> **Quick guide** for choosing your workflow. For comprehensive sync behavior reference, see [Sync Behavior](/docs/03-concepts/sync-behavior).

## The two workflows

### IR-source workflow

**You edit rules.md as your source of truth.**

- Rules are written in `.aligntrue/rules.md` (literate markdown format)
- Auto-pull is disabled to prevent overwriting your edits
- Changes flow one direction: rules.md → agent files
- Use `--accept-agent` explicitly when you want to pull from agents

**Best for:**

- Teams where rules need review before merging
- Documentation-focused workflows
- When you want full control over sync direction
- Projects where rules are treated as code

**Setup:**

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "ir_source"
  auto_pull: false
```

### Native-format workflow

**You edit agent files directly (e.g., Cursor .mdc files).**

- Edit rules in your agent's native format (`.cursor/rules/*.mdc`)
- Auto-pull automatically syncs changes to rules.md
- Changes flow both directions seamlessly
- AlignTrue keeps everything in sync

**Best for:**

- Solo developers who prefer their agent's native format
- Quick experimentation and iteration
- When you trust the agent format
- Workflows where rules.md is just a backup

**Setup:**

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "native_format"
  auto_pull: true
  primary_agent: "cursor"
```

## Comparison

| Aspect           | IR-source               | Native-format              |
| ---------------- | ----------------------- | -------------------------- |
| Edit location    | `.aligntrue/rules.md`   | Agent files (`.cursor/*`)  |
| Auto-pull        | Disabled                | Enabled                    |
| Sync direction   | One-way (IR → agents)   | Two-way (IR ↔ agents)     |
| Manual control   | High                    | Low                        |
| Conflict prompts | Rare                    | Occasional                 |
| Best for         | Teams, review workflows | Solo devs, rapid iteration |

## Choosing your workflow

### Choose IR-source if you:

- Work in a team that reviews rule changes
- Want rules versioned and reviewed like code
- Need to document rule rationale in markdown
- Prefer explicit control over sync operations
- Use version control workflows (PRs, branches)

### Choose native-format if you:

- Work solo and want minimal friction
- Prefer editing in your agent's native UI
- Trust auto-sync to handle changes correctly
- Want AlignTrue to "just work" in the background
- Iterate quickly and don't need explicit control

## Configuring your workflow

### Automatic configuration during init

AlignTrue automatically configures your workflow mode during initialization:

**If you import existing rules:**

```bash
aligntrue init
# Detects .cursor/rules/*.mdc
# Offers to import
# Sets workflow_mode: native_format
# Enables auto_pull
```

**If you start fresh:**

```bash
aligntrue init
# No existing rules detected
# Creates starter template
# Sets workflow_mode: ir_source
# Disables auto_pull
```

**Explicit import:**

```bash
aligntrue init --import cursor
# Forces import from Cursor
# Sets workflow_mode: native_format
```

### First-time configuration (legacy)

On your first conflict, AlignTrue will prompt you:

```
💡 This is your first conflict. Let's configure your workflow.

? Which workflow do you prefer?
  > Edit native agent formats (recommended for solo devs)
    Edit rules.md as source of truth
    Let me decide each time
```

Your choice is saved and applied automatically on future syncs.

### Manual configuration

Edit `.aligntrue/config.yaml`:

```yaml
sync:
  # Choose one:
  workflow_mode: "ir_source"      # Edit rules.md
  workflow_mode: "native_format"  # Edit agent files
  workflow_mode: "auto"           # Prompt each time (default)
```

### Changing workflows

You can change at any time:

```bash
# Switch to IR-source
aligntrue config set sync.workflow_mode ir_source

# Switch to native-format
aligntrue config set sync.workflow_mode native_format

# Reset to auto (prompt mode)
aligntrue config set sync.workflow_mode auto
```

## Workflow tips

### IR-source workflow tips

**1. Disable auto-pull explicitly:**

```yaml
sync:
  workflow_mode: "ir_source"
  auto_pull: false # Be explicit
```

**2. Pull from agents manually:**

```bash
aligntrue sync --accept-agent cursor
```

**3. Use dry-run to preview:**

```bash
aligntrue sync --dry-run
```

**4. Commit rules.md to version control:**

```bash
git add .aligntrue/rules.md
git commit -m "feat: Add security rules"
```

### Native-format workflow tips

**1. Enable diff summaries:**

```yaml
sync:
  workflow_mode: "native_format"
  show_diff_on_pull: true # See what changed
```

**2. Review diffs regularly:**

```bash
aligntrue sync --show-auto-pull-diff
```

**3. Trust but verify:**
Check rules.md occasionally to ensure auto-sync is working correctly.

**4. Keep backups enabled:**

```yaml
backup:
  auto_backup: true
  backup_on: ["sync"]
```

## Mixed workflows (advanced)

You can use both workflows in the same project:

1. **Different directories:** IR-source for `/team-rules`, native-format for `/personal-rules`
2. **Different branches:** IR-source on `main`, native-format on `feature/*`
3. **Different team members:** Let each dev choose their preferred workflow

**Note:** Mixed workflows require careful coordination to avoid conflicts.

## Conflict handling

### In IR-source mode

Conflicts are rare because auto-pull is disabled. If you manually pull:

```bash
aligntrue sync --accept-agent cursor
```

You'll see a prompt if both files were modified.

### In native-format mode

Conflicts happen when you edit both rules.md AND agent files between syncs:

```
⚠ Conflict detected:
  - You edited .aligntrue/rules.md
  - Changes also found in .cursor/rules/aligntrue.mdc

Workflow: Native-format (accepting cursor changes)
```

AlignTrue automatically resolves based on your workflow mode.

### In auto mode

You're prompted every time:

```
? How would you like to resolve this conflict?
  > Keep my edits to rules.md (skip auto-pull)
    Accept changes from cursor
    Abort sync and review manually
```

## Team considerations

### Solo mode

Either workflow works. Choose based on your preference.

### Team mode

**Recommended: IR-source workflow**

Reasons:

- Rules reviewed before syncing to agents
- Clear source of truth (rules.md)
- Easier to track changes in version control
- Prevents accidental overwrites

Configuration for teams:

```yaml
mode: team
sync:
  workflow_mode: "ir_source"
  auto_pull: false
  on_conflict: "prompt" # Explicit resolution
lockfile:
  mode: "strict"
git:
  mode: "commit"
```

## Troubleshooting

### "I keep getting conflict prompts"

Set a workflow mode to auto-resolve:

```bash
aligntrue config set sync.workflow_mode native_format
```

### "Auto-pull overwrote my rules.md edits"

Switch to IR-source mode:

```bash
aligntrue config set sync.workflow_mode ir_source
aligntrue backup restore --to <timestamp>
```

### "Changes not syncing"

Check your workflow mode:

```bash
aligntrue config get sync.workflow_mode
```

Verify auto-pull setting:

```bash
aligntrue config get sync.auto_pull
```

## Related pages

- [Auto-pull behavior](/docs/01-guides/00-auto-pull) - How auto-pull works
- [Sync behavior](/docs/02-concepts/sync-behavior) - Technical sync details
- [Troubleshooting conflicts](/docs/04-troubleshooting/conflicts) - Resolving conflicts
- [Team mode](/docs/02-concepts/team-mode) - Team workflows and lockfiles
