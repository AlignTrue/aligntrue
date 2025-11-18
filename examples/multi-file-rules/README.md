# Multi-File Rule Organization Example

This example demonstrates how to organize rules across multiple markdown files instead of a single `AGENTS.md` file.

## Overview

Instead of maintaining all rules in a single `AGENTS.md` file, you can split them into multiple files organized by concern:

- `rules/architecture.md` - System design and architecture guidelines
- `rules/security.md` - Security best practices
- `rules/coding-standards.md` - Code style and conventions

## Benefits

1. **Better Organization**: Logical separation of concerns
2. **Easier Maintenance**: Find and update specific rule categories quickly
3. **Team Collaboration**: Different team members can own different files
4. **Reduced Conflicts**: Fewer merge conflicts when multiple people edit rules

## Configuration

The `.aligntrue/config.yaml` file specifies the source files:

```yaml
exporters:
  - cursor
  - agents

sync:
  source_files: "rules/*.md"
  source_order:
    - architecture.md
    - security.md
    - coding-standards.md
```

## How It Works

1. **Source Files**: AlignTrue reads all `.md` files in the `rules/` directory
2. **Ordering**: Files are merged in the order specified by `source_order` (or alphabetically if not specified)
3. **Provenance**: Each section tracks which source file it came from
4. **Two-Way Sync**: You can edit any source file, and changes sync to all agents

## Usage

```bash
# Initialize AlignTrue
aligntrue init

# List source files
aligntrue sources list

# Sync rules to all agents
aligntrue sync

# Split an existing AGENTS.md into multiple files
aligntrue sources split
```

## Migrating from Single File

If you have an existing `AGENTS.md`, you can split it:

```bash
# Interactive split (prompts for confirmation and target directory)
aligntrue sources split

# Non-interactive split
aligntrue sources split --yes
```

This will:

1. Parse sections from `AGENTS.md`
2. Create separate files for each section
3. Update config to use the new files
4. Optionally backup the original `AGENTS.md`

## Best Practices

1. **Logical Grouping**: Group related rules into the same file
2. **Clear Naming**: Use descriptive filenames (e.g., `security.md`, not `rules1.md`)
3. **Consistent Structure**: Use similar heading levels across files
4. **Custom Order**: Specify `source_order` if the merge order matters
5. **Team Ownership**: Assign file ownership in your team's CODEOWNERS

## Example Structure

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

## Comparison with Ruler

This feature provides similar functionality to Ruler's nested directory support, but with:

- **Two-way sync**: Edit any source file or agent file
- **Conflict detection**: Automatic detection and resolution of conflicting edits
- **Team mode**: Lockfile validation and drift detection
- **Agent parity**: Consistent behavior across all 43+ supported agents
