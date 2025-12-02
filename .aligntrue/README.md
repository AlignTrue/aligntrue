# .aligntrue

This directory contains your AlignTrue configuration and rules.

## Directory structure

- **`rules/`** - THE ONLY DIRECTORY YOU SHOULD EDIT. This is your single source of truth for all agent rules.
- **`config.yaml`** - Configuration file (created during init, can be edited for settings)
- **`.backups/`** - Automatic backups of configurations and individual files (gitignored, for your reference only)
  - `snapshots/` - Full directory snapshots before destructive operations
  - `files/` - Individual file backups when files are replaced
- **`.cache/`** - Generated cache for performance (gitignored)

## Editing rules

All your rules belong in `rules/` as markdown files:

```markdown
---
title: "My Rule"
description: "Description"
scope: "packages/app"
cursor:
  when: "alwaysOn"
---

# My Rule Content

...
```

After editing, run:

```bash
aligntrue sync
```

## Safe by default

- AlignTrue never edits agent-specific folders like `.cursor/plans/`, `.cursor/memories/`, etc.
- Only configuration files defined in `.aligntrue/` and exported agent files are touched.
- Backups are automatically created before overwriting any manually edited files.

## Organization

- You can create subdirectories in `rules/` (e.g. `rules/frontend/`, `rules/api/`)
- AlignTrue detects nested directories and mirrors them to agents
- Frontmatter options like `exclude_from` and `export_only_to` control which exporters receive each rule

## More information

- View exported files in your root directory (e.g., `AGENTS.md`, `.cursor/rules/`)
- Check `config.yaml` for settings (exporters, sources, git integration)
- Run `aligntrue --help` for CLI commands
