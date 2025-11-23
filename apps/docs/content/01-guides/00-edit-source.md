---
title: "Choosing an edit source"
description: "Select which file to edit. All others become read-only exports."
---

# Choosing your edit source

The `sync.edit_source` setting controls which file(s) you can edit. All other files become read-only exports with warning comments.

## How it works

When you run `aligntrue sync`:

1. **Load your edit source** - The pattern(s) you configured
2. **Check for edits** - See which files matching your pattern were modified
3. **Merge to IR** - Your edits flow to `.aligntrue/.rules.yaml` (internal representation)
4. **Export to all agents** - IR syncs to all configured agents (read-only)

**One-way flow:** `edit_source` → IR → all other formats (read-only)

## Automatic defaults

If you don't specify `edit_source` in your config, AlignTrue automatically chooses based on your configured exporters:

**Priority order:**

1. Cursor (`.cursor/rules/*.mdc`) - if Cursor exporter is enabled
2. AGENTS.md - if agents exporter is enabled
3. First enabled exporter's default pattern

**Example:**

```yaml
# .aligntrue/config.yaml
exporters:
  - cursor
  - agents
# edit_source not specified → automatically uses ".cursor/rules/*.mdc"
```

You can always override with an explicit `sync.edit_source` setting.

## Recommended patterns

### Universal format (AGENTS.md)

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: "AGENTS.md"
```

**Best for:** Most teams. Works everywhere. Human-readable markdown.

```bash
nano AGENTS.md      # Edit your rules
aligntrue sync      # Changes export to all agents
```

### Cursor native format

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
```

**Best for:** Cursor-first workflows. Full Cursor rule syntax. Supports multiple rule files (e.g., `aligntrue.mdc`, `backend.mdc`, `frontend.mdc`).

```bash
nano .cursor/rules/aligntrue.mdc  # Edit Cursor rules
# Or create scope-specific files:
nano .cursor/rules/backend.mdc
aligntrue sync                     # Changes export to all agents
```

### Cursor with scopes

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
  scope_prefixing: "auto"
```

**Best for:** Monorepos. Separate rules per backend/frontend/etc.

```bash
nano .cursor/rules/backend.mdc    # Edit backend-specific rules
nano .cursor/rules/frontend.mdc   # Edit frontend-specific rules
aligntrue sync                     # Changes export to all agents with scope routing
```

### Multi-file markdown

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ".aligntrue/rules/*.md"
```

**Best for:** Teams, users migrating from Ruler. Human-friendly multi-file organization.

```bash
mkdir -p .aligntrue/rules
nano .aligntrue/rules/architecture.md  # Edit architecture rules
nano .aligntrue/rules/testing.md       # Edit testing rules
aligntrue sync                          # Changes export to all agents
```

## Read-only exports

Files NOT matching your `edit_source` are **read-only** with warning comments:

```markdown
<!-- AlignTrue: This file is read-only.
     Edit source is configured as: AGENTS.md
     To edit these rules, update AGENTS.md and run: aligntrue sync
-->
```

**What happens if you edit a read-only file?**

When you run `aligntrue sync`, AlignTrue detects edits to read-only files and shows warnings:

```
⚠ .cursor/rules/aligntrue.mdc was edited but is not in edit_source
  File was edited but is not in edit_source configuration
  To enable editing: aligntrue config set sync.edit_source '".cursor/rules/*.mdc"'
```

**Important:** Manual edits to read-only files ARE automatically overwritten on next sync (after backing up to `.aligntrue/overwritten-rules/`). To preserve your edits, update your `edit_source` configuration first.

**Why read-only?**

- Prevents accidental edits to exports
- Ensures single source of truth
- Clear ownership and conflict prevention

**If you need to edit different files:**

Option 1: Change your `edit_source` config

```bash
aligntrue config set sync.edit_source ".cursor/rules/*.mdc"
aligntrue sync  # Now Cursor files are editable
```

Option 2: Use experimental decentralized mode (see [Advanced options](#advanced-options))

## Auto-detection during init

When you run `aligntrue init`, AlignTrue auto-detects your agents and recommends the best edit source:

**Detection logic:**

- Cursor installed → suggests `.cursor/rules/*.mdc`
- No Cursor but AGENTS.md exists → suggests `AGENTS.md`
- Other agent files → suggests first detected agent's pattern
- Nothing detected → suggests `AGENTS.md` (universal format)

**Interactive mode:**

```bash
aligntrue init
# Prompts you to choose edit source based on detected agents
```

**Non-interactive mode (`--yes`):**

```bash
aligntrue init --yes
# Automatically selects best edit source based on detection
# Can auto-switch if untracked files with content are detected
```

You can override this:

```bash
aligntrue init --yes --edit-source "AGENTS.md"
```

## Advanced options

### Multi-source editing (experimental)

For experimental multi-source editing where you can edit multiple files simultaneously:

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]
  centralized: false # Required for array edit_source
```

**Requirements:**

- Set `centralized: false` in config
- `edit_source` must be an array

**Note:** Decentralized mode is no longer supported.

### Editing IR directly

You can also edit `.aligntrue/.rules.yaml` directly, but this is **not recommended** as it requires understanding the internal YAML format and has a high likelihood of corrupting your setup. Use your configured `edit_source` instead.

## Troubleshooting

**"File was edited but is not in edit_source" warning:**

- Update your `edit_source` config to include that file/pattern
- Or remove your edits and edit files that match your current `edit_source`

**Want to switch edit sources:**

```bash
aligntrue config set sync.edit_source ".cursor/rules/*.mdc"
aligntrue sync  # Now Cursor files are editable
```

**Check your current edit source:**

```bash
aligntrue config get sync.edit_source
# Or
aligntrue status  # Shows edit source in summary
```
