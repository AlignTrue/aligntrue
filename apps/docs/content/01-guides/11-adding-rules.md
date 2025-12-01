---
title: Adding rules
description: Import rules from URLs, git repositories, local paths, and auto-detect existing agent files
---

# Adding rules

AlignTrue provides flexible ways to add rules to your project, whether you're starting fresh, importing from external sources, or discovering existing agent files.

## Quick reference

| Scenario                                | Command                                    |
| --------------------------------------- | ------------------------------------------ |
| New project, auto-detect existing rules | `aligntrue init`                           |
| New project, import from git repo       | `aligntrue init --source <git-url>`        |
| New project, stay connected for updates | `aligntrue init --source <git-url> --link` |
| Existing project, add rules             | `aligntrue add <git-url>`                  |
| Existing project, stay connected        | `aligntrue add <git-url> --link`           |
| Find untracked agent files              | `aligntrue sources detect`                 |
| Import detected files                   | `aligntrue sources detect --import`        |

## Auto-detect existing rules (new users)

When you run `aligntrue init` without options, it automatically scans your project for existing agent files:

```bash
cd your-project
aligntrue init
```

**What it detects:**

- `.cursor/rules/*.mdc` - Cursor rules
- `AGENTS.md` - GitHub Copilot, Aider, Claude Code
- `CLAUDE.md` - Claude Code
- `.windsurf/rules/` - Windsurf
- And many more agent formats

**What happens:**

1. Scans for existing agent files
2. Parses and converts them to `.aligntrue/rules/*.md` format
3. Creates `.aligntrue/config.yaml` with detected exporters
4. Runs initial sync to export back to all agents

If no existing rules are found, AlignTrue creates starter templates to help you get started.

## Import rules from external sources

### One-time import (default)

Import rules from a git repository or local path. Rules are copied to `.aligntrue/rules/` and become yours to edit:

```bash
# During init (new project)
aligntrue init --source https://github.com/org/rules

# After init (existing project)
aligntrue add https://github.com/org/rules
```

**Supported sources:**

- GitHub/GitLab repositories: `https://github.com/org/repo`
- Specific directory in repo: `https://github.com/org/repo/path/to/rules`
- Specific version: `https://github.com/org/repo@v1.0.0`
- SSH URLs: `git@github.com:org/repo.git`
- Local paths: `./path/to/rules` or `/absolute/path`

**What happens:**

1. Fetches rules from the source
2. Converts to `.md` format with proper frontmatter
3. Adds `source` and `source_added` metadata
4. Copies to `.aligntrue/rules/`

**Frontmatter added:**

```yaml
---
title: Imported Rule
source: https://github.com/org/rules
source_added: 2025-11-29
---
```

### Connected sources (updates on sync)

Use `--link` to keep the source connected. Rules will be fetched on each `aligntrue sync`:

```bash
# During init
aligntrue init --source https://github.com/org/rules --link

# After init
aligntrue add https://github.com/org/rules --link
```

**When to use `--link`:**

- Team standards that evolve over time
- Your personal rules stored in a separate repo
- Community rule packs you want to track

**Config result:**

```yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: https://github.com/org/rules
    ref: main
```

## Conflict handling

When importing rules that have the same filename as existing rules:

**Interactive mode:**

```
⚠ Rule conflict: typescript.md already exists

  Existing: .aligntrue/rules/typescript.md (local, modified 2 days ago)
  Incoming: typescript.md from https://github.com/org/rules

Options:
  1. Replace - Overwrite existing (backup saved)
  2. Keep both - Save incoming as typescript-1.md
  3. Skip - Don't import this rule

Choose [1/2/3]:
```

**Non-interactive mode (`--yes`):**
Defaults to "keep both" to avoid data loss.

**Backups:**
When you choose "Replace", the existing rule is backed up to `.aligntrue/.backups/files/` with a timestamp.

## Find untracked agent files

After initial setup, you may add new agent files manually or have team members who added rules without AlignTrue. Use `sources detect` to find them:

```bash
# List untracked agent files
aligntrue sources detect

# Import them to .aligntrue/rules/
aligntrue sources detect --import
```

**Output:**

```
Found 3 agent file(s):

  CURSOR (2 files)
    - .cursor/rules/new-rule.mdc
    - .cursor/rules/another.mdc

  AGENTS (1 file)
    - AGENTS.md

To import these files, run:
  aligntrue sources detect --import
```

## Removing imported rules

### Copied rules (default import)

Simply delete the files and sync:

```bash
rm .aligntrue/rules/unwanted-rule.md
aligntrue sync
```

### Linked sources

Use the remove command:

```bash
aligntrue remove https://github.com/org/rules
aligntrue sync
```

## Version pinning

For git sources, pin to a specific version:

```bash
# Tag
aligntrue add https://github.com/org/rules --ref v1.0.0

# Branch
aligntrue add https://github.com/org/rules --ref develop

# Commit
aligntrue add https://github.com/org/rules --ref abc123
```

## Local paths

Import from local directories (useful for monorepos or shared rule sets):

```bash
# Relative path
aligntrue add ./shared/rules

# Absolute path
aligntrue add /Users/me/my-rules
```

## How import works

When you use `aligntrue add` or `aligntrue init --source`, the import process:

- **Targets any file or folder**: Local paths (relative or absolute), remote files, or directories
- **Scans recursively**: Finds all `.md` and `.mdc` files in subdirectories
- **Preserves filenames**: Uses the original filename instead of generating from the title
- **Preserves structure**: Maintains subdirectory organization (e.g., `backend/security.md` → `.aligntrue/rules/backend/security.md`)
- **Converts formats**: Converts `.mdc` files to `.md` format during import
- **Adds metadata**: Records the source in frontmatter for tracking

**Example import:**

```bash
# Import from a remote directory (any subdirectory)
aligntrue add https://github.com/company/rules/backend

# Results in:
# .aligntrue/rules/
#   ├── security.md         (from backend/security.md)
#   └── performance/
#       └── caching.md      (from backend/performance/caching.md)
```

## File format conversion

AlignTrue automatically converts imported files to `.md` format:

- `.mdc` (Cursor) → `.md`
- `.yaml` rule manifests → `.md`
- Multi-section files → split into individual `.md` files

**Note:** Only `.md` files are processed in `.aligntrue/rules/`. If you manually copy other file types, you'll see a warning during sync:

```
⚠ Warning: Non-markdown files detected in .aligntrue/rules/
  - old-rule.mdc, config.yaml

Only .md files are processed. Rename to .md if you want them included.
```

## Workflow examples

### Try rules from social media

Someone shared cool rules on X/Twitter:

```bash
# Add them to try
aligntrue add https://github.com/someone/cool-rules

# After testing, if you don't like them
rm .aligntrue/rules/cool-*.md
aligntrue sync
```

### Personal rules across projects

Keep your rules in a repo and use them everywhere:

```bash
# In each project
aligntrue add https://github.com/me/my-rules --link

# Update rules in your repo, then in any project:
aligntrue sync  # Pulls latest
```

### Team standards with local overrides

```bash
# Link team standards
aligntrue add https://github.com/company/standards --link

# Add local overrides in .aligntrue/rules/
# Local rules take precedence over linked sources
```

## See also

- [Managing sources](/docs/01-guides/08-managing-sources) - Advanced source configuration
- [Plugs](/docs/02-customization/plugs) - Fill template slots in external rules
- [Overlays](/docs/02-customization/overlays) - Customize external rules without forking
