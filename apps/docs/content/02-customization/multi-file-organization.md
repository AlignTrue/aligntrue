---
title: Multi-File Rule Organization
description: Organize rules across multiple markdown files for better maintainability
---

# Multi-File Rule Organization

Instead of maintaining all rules in a single `AGENTS.md` file, AlignTrue supports organizing rules across multiple markdown files. This is especially useful for large projects with many rules or teams where different people own different rule categories.

## Overview

Multi-file organization allows you to:

- Split rules into logical categories (e.g., `architecture.md`, `security.md`, `coding-standards.md`)
- Reduce merge conflicts when multiple people edit rules
- Make it easier to find and update specific rule types
- Maintain clear ownership of different rule categories

## Configuration

Configure multi-file sources in `.aligntrue/config.yaml`:

```yaml
sync:
  source_files: "rules/*.md" # Glob pattern for source files
  source_order: # Optional: custom merge order
    - architecture.md
    - security.md
    - coding-standards.md
```

### Source file patterns

The `source_files` field accepts:

- **Single file**: `"AGENTS.md"` (default)
- **Glob pattern**: `"rules/*.md"` (all `.md` files in `rules/` directory)
- **Array of patterns**: `["arch.md", "security.md"]` (specific files)

### Source order

By default, files are merged alphabetically by basename. Use `source_order` to specify a custom order:

```yaml
sync:
  source_order:
    - important-first.md
    - then-this.md
    - finally-this.md
```

Files not listed in `source_order` are appended alphabetically at the end.

## How it works

### Discovery

AlignTrue discovers source files using the configured patterns:

1. Resolves glob patterns relative to workspace root
2. Reads all matching markdown files
3. Parses sections from each file

### Merging

Source files are merged into a single internal representation:

1. Files are ordered (alphabetically or by `source_order`)
2. Sections from each file are concatenated in order
3. Each section tracks its source file for provenance

### Provenance

Every section includes metadata about its source file:

```yaml
sections:
  - heading: "Architecture Guidelines"
    content: "..."
    vendor:
      aligntrue:
        source_file: "architecture.md" # Tracks origin
```

This metadata helps with:

- Debugging which file a section came from
- Two-way sync (editing the right source file)
- Conflict resolution

## CLI Commands

### List source files

View all configured source files and their section counts:

```bash
aligntrue sources list
```

Output:

```
Source patterns: rules/*.md
Custom order: architecture.md, security.md, coding-standards.md

Found 3 source files:

  rules/architecture.md (5 sections)
  rules/security.md (8 sections)
  rules/coding-standards.md (6 sections)
```

### Split existing AGENTS.md

Convert a single `AGENTS.md` file into multiple files:

```bash
# Interactive (prompts for confirmation and target directory)
aligntrue sources split

# Non-interactive
aligntrue sources split --yes
```

This command:

1. Parses sections from `AGENTS.md`
2. Creates a separate file for each section
3. Updates config to use the new files
4. Optionally backs up the original `AGENTS.md`

## Example project structure

```
project/
├── .aligntrue/
│   └── config.yaml
├── rules/
│   ├── architecture.md
│   ├── security.md
│   └── coding-standards.md
├── .cursor/
│   └── rules/
│       └── combined.mdc  (generated)
└── AGENTS.md  (generated)
```

## Two-Way Sync

Multi-file sources work seamlessly with two-way sync:

1. **Edit any source file**: Make changes to `rules/security.md`
2. **Run sync**: `aligntrue sync`
3. **Changes propagate**: Updates sync to all agent files

AlignTrue tracks which file each section came from, so edits to agent files can be merged back to the correct source file.

## Best practices

### File organization

- **Group related rules**: Put all security rules in `security.md`
- **Use clear names**: `security.md` not `rules1.md`
- **Keep files focused**: One concern per file
- **Limit file count**: 3-10 files is ideal; too many becomes hard to navigate

### Naming conventions

- Use lowercase with hyphens: `coding-standards.md`
- Be descriptive: `api-design-guidelines.md`
- Avoid abbreviations unless well-known: `security.md` not `sec.md`

### Team collaboration

- **Assign ownership**: Use `CODEOWNERS` to assign file ownership
- **Custom order**: Use `source_order` to prioritize important files
- **Clear boundaries**: Make it obvious which rules belong in which file

### Migration strategy

When migrating from single-file to multi-file:

1. **Start small**: Split into 3-5 logical categories
2. **Test thoroughly**: Run `aligntrue sync` and verify outputs
3. **Update team docs**: Document the new structure
4. **Keep backup**: Don't delete `AGENTS.md` immediately

## Comparison with Single-File

| Aspect              | Single File (AGENTS.md)     | Multi-File                 |
| ------------------- | --------------------------- | -------------------------- |
| **Setup**           | Simpler                     | Requires config            |
| **Navigation**      | Scroll through one file     | Jump between files         |
| **Merge Conflicts** | More frequent               | Less frequent              |
| **Ownership**       | Shared                      | Can be per-file            |
| **Organization**    | Sections within file        | Files and sections         |
| **Best For**        | Small projects (< 20 rules) | Large projects (20+ rules) |

## Troubleshooting

### Files not found

If `aligntrue sources list` shows no files:

1. Check the glob pattern in `sync.source_files`
2. Verify files exist relative to workspace root
3. Check file extensions match the pattern

### Wrong merge order

If sections appear in the wrong order:

1. Add or update `sync.source_order` in config
2. List files in desired order
3. Run `aligntrue sync` to regenerate

### Section conflicts

If you see "Section conflict" warnings:

1. Check if the same section heading exists in multiple files
2. Rename one of the headings to make them unique
3. Or merge the duplicate sections into one file

## Related Features

- [Two-Way Sync](/docs/03-concepts/sync-behavior) - Edit agent files or source files
- [Scopes](/docs/02-customization/scopes) - Path-based rule application for monorepos
- [Team Mode](/docs/01-guides/05-team-guide) - Lockfile validation and drift detection

## Example

See the [multi-file-rules example](/examples/multi-file-rules) for a complete working example with:

- Multiple source files organized by concern
- Custom merge order
- Documentation and best practices
