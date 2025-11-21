---
title: "Choosing Your Edit Source"
description: "Select which file to edit. All others become read-only exports."
---

# Choosing Your Edit Source

The `sync.edit_source` setting controls which file(s) you can edit. All other files become read-only exports with warning comments.

## How it works

When you run `aligntrue sync`:

1. **Load your edit source** - The pattern(s) you configured
2. **Check for edits** - See which files matching your pattern were modified
3. **Merge to IR** - Your edits flow to `.aligntrue/.rules.yaml` (internal representation)
4. **Export to all agents** - IR syncs to all configured agents (read-only)

**One-way flow:** `edit_source` → IR → all other formats (read-only)

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
  edit_source: ".cursor/rules/aligntrue.mdc"
```

**Best for:** Cursor-first workflows. Full Cursor rule syntax.

```bash
nano .cursor/rules/aligntrue.mdc  # Edit Cursor rules
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

## Read-only exports

Files NOT matching your `edit_source` are **read-only** with warning comments:

```markdown
<!-- AlignTrue: This file is read-only.
     Edit source is configured as: AGENTS.md
     To edit these rules, update AGENTS.md and run: aligntrue sync
-->
```

**Why read-only?**

- Prevents accidental edits to exports
- Ensures single source of truth
- Guarantees next sync won't overwrite your changes

**If you need to edit different files:**

Option 1: Change your `edit_source` config

```bash
aligntrue config set sync.edit_source ".cursor/rules/*.mdc"
aligntrue sync  # Now Cursor files are editable
```

Option 2: Use experimental decentralized mode (see [Experimental Features](/docs/04-reference/experimental))

## Auto-detection during init

When you run `aligntrue init`, AlignTrue auto-detects your agents and recommends the best edit source:

```bash
aligntrue init --yes

# Detects: Cursor installed → suggests .cursor/rules/*.mdc
# OR detects: No Cursor → suggests AGENTS.md
```

You can override this:

```bash
aligntrue init --yes --edit-source "AGENTS.md"
```

## Advanced options

For experimental multi-source editing where you can edit multiple files simultaneously, see [Experimental Features](/docs/04-reference/experimental). This requires `experimental_two_way_sync: true` and is not recommended for most users.
