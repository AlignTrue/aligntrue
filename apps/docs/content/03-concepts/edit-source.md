---
title: Edit source configuration
description: Control which files accept edits and sync to the internal representation
---

# Edit source configuration

The `sync.edit_source` configuration controls which files can be edited and will sync back to AlignTrue's internal representation (IR).

## Overview

By default, AlignTrue exports rules to multiple agent formats (Cursor, AGENTS.md, etc.). The `edit_source` setting determines which of these files should accept your edits.

## Configuration Options

### Single File (Recommended)

Edit rules in one primary location:

```yaml
# .aligntrue/config.yaml
sync:
  edit_source: "AGENTS.md" # Edit AGENTS.md only
```

or

```yaml
sync:
  edit_source: ".cursor/rules/*.mdc" # Edit any Cursor file
```

### Multiple Files

Allow editing in multiple locations:

```yaml
sync:
  edit_source:
    - "AGENTS.md"
    - ".cursor/rules/*.mdc"
```

Changes from any of these files will merge to IR on next sync.

### Special Modes

**All agent files:**

```yaml
sync:
  edit_source: "any_agent_file"
```

**IR only (advanced):**

```yaml
sync:
  edit_source: ".rules.yaml"
```

## How It Works

### 1. Edit Detection

When you run `aligntrue sync`, AlignTrue checks which files have been modified:

- If file matches `edit_source`: Changes are pulled into IR
- If file doesn't match: File is marked read-only and regenerated from IR

### 2. Read-Only Protection

Files not in `edit_source` get warning markers:

```markdown
<!-- WARNING: READ-ONLY FILE - DO NOT EDIT

This file is auto-generated from: .cursor/rules/*.mdc

Edits to this file will be LOST on next sync.
-->
```

### 3. Conflict Resolution

If the same section is edited in multiple files:

- **Last-write-wins**: File with newest modification time wins
- **Warning displayed**: Shows which files conflicted
- **Backup created**: Original changes preserved in backups

## Scope-Aware Multi-File Editing

When using Cursor with multiple scope files (e.g., `backend.mdc`, `frontend.mdc`), AlignTrue tracks which file each section originated from using metadata.

### Example Workflow

1. Edit `.cursor/rules/backend.mdc` - add "Backend Security" section
2. Edit `.cursor/rules/frontend.mdc` - add "Frontend Security" section
3. Run `aligntrue sync`
4. Both sections sync to AGENTS.md (optionally with scope prefixes)
5. Next sync routes sections back to correct Cursor files

## Choosing an Edit Source

### Cursor Priority

If you use Cursor, set:

```yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
```

**Benefits:**

- Full feature support (frontmatter, globs, vendor metadata)
- Multi-scope organization
- Best round-trip fidelity

### AGENTS.md Priority

For universal compatibility:

```yaml
sync:
  edit_source: "AGENTS.md"
```

**Benefits:**

- Single file simplicity
- Works with all AI assistants
- Easy to review in one place

### Both (Flexible)

Allow editing either:

```yaml
sync:
  edit_source: ["AGENTS.md", ".cursor/rules/*.mdc"]
```

**Tradeoff:** May cause conflicts if same section edited in both places.

## Migration from two_way

The deprecated `sync.two_way` boolean automatically migrates:

- `two_way: false` → `edit_source: ".rules.yaml"`
- `two_way: true` → `edit_source: "any_agent_file"`

## Best Practices

1. **Choose one primary source** for most projects
2. **Use glob patterns** for multi-file agents like Cursor
3. **Enable backups** to prevent data loss
4. **Review conflicts** when they occur

## Related Configuration

### Scope Prefixing

Add scope prefixes to AGENTS.md when syncing from multiple Cursor files:

```yaml
sync:
  edit_source: ".cursor/rules/*.mdc"
  scope_prefixing: "auto" # or "always" or "off"
```

Result in AGENTS.md:

```markdown
## Backend: Security

Use authentication for all endpoints.

## Frontend: Security

Sanitize all user inputs.
```

### Managed Sections

Team-managed sections work with any edit_source:

```yaml
managed:
  sections:
    - "Security"
    - "Compliance"
```

These sections remain protected regardless of edit_source.

## Troubleshooting

**Problem:** Changes to AGENTS.md not syncing

**Solution:** Check if AGENTS.md is in your `edit_source`

**Problem:** Cursor file changes lost

**Solution:** Set `edit_source: ".cursor/rules/*.mdc"`

**Problem:** Conflicts between files

**Solution:** Choose one primary edit source or use scope prefixing
