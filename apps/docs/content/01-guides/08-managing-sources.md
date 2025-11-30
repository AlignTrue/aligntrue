---
title: Managing rule sources
description: Add, combine, and customize external rules from git repositories and other sources
---

# Managing rule sources

Configure multiple sources to combine your local rules with external rule sets from git repositories, shared organizations, or community maintainers.

## Copied vs linked sources

AlignTrue supports two ways to add external rules:

| Method             | Command                      | Behavior                               | When to use                               |
| ------------------ | ---------------------------- | -------------------------------------- | ----------------------------------------- |
| **Copy** (default) | `aligntrue add <url>`        | One-time import to `.aligntrue/rules/` | Templates, trials, rules you'll customize |
| **Link**           | `aligntrue add <url> --link` | Fetched on each sync                   | Team standards, personal rules repo       |

**Copied rules** become yours to edit. They're stored in `.aligntrue/rules/` with `source` metadata in frontmatter.

**Linked sources** stay connected. They're configured in `config.yaml` and refreshed on each `aligntrue sync`.

See [Adding rules](/docs/01-guides/11-adding-rules) for detailed workflows.

## How linked sources work

**Your local rules** (`.aligntrue/rules/`) are always included automatically and have the highest priority.

**Linked sources** can be added to pull in additional rules:

- Combine rules from multiple git repositories
- Pin specific versions with git tags or branches
- Customize external rules with plugs and overlays
- Override external rules with your local versions

### Source types

| Type    | Example               | Use case                            |
| ------- | --------------------- | ----------------------------------- |
| `git`   | GitHub, GitLab, Gitea | Versioned rule sets, team standards |
| `local` | Sibling directories   | Monorepo shared rules (rare)        |

## Priority order

Rules merge in this order (highest to lowest priority):

```
1. Local rules (.aligntrue/rules/) ← ALWAYS FIRST, ALWAYS WINS
2. First external source listed
3. Second external source listed
4. ... (in order)
```

When the same rule appears in multiple sources, the first source wins. Your local rules always override external sources on conflict.

## Adding external sources

External sources use the new `include` syntax with fully-qualified URLs:

### URL format

AlignTrue supports two URL formats:

**Standard format:**

```
https://{host}/{org}/{repo}[@{ref}][/{path}]
```

**GitHub web UI format (also supported):**

```
https://github.com/{org}/{repo}/tree/{ref}/{path}
https://github.com/{org}/{repo}/blob/{ref}/{path}
```

This means you can copy URLs directly from GitHub's web interface.

| Part       | Example         | Purpose                                                  |
| ---------- | --------------- | -------------------------------------------------------- |
| `host`     | `github.com`    | Git hosting platform                                     |
| `org/repo` | `company/rules` | Repository location                                      |
| `@ref`     | `@v2.0.0`       | Optional: branch, tag, or commit (default: `main`)       |
| `/{path}`  | `/aligns`       | Optional: file or directory (default: all `.md` in root) |

### Examples

```yaml
version: "1"
mode: solo
sources:
  - type: git
    include:
      # All .md files in repo root
      - https://github.com/company/rules

      # All .md files in aligns directory
      - https://github.com/company/rules/aligns

      # Single specific file
      - https://github.com/company/rules/aligns/security.md

      # Specific version (branch or tag)
      - https://github.com/company/rules@v2.0.0

      # Specific version + directory
      - https://github.com/company/rules@v2.0.0/aligns

      # GitHub web UI URL (copied from browser)
      - https://github.com/company/rules/tree/main/aligns

      # GitHub blob URL (for single files)
      - https://github.com/company/rules/blob/v2.0.0/aligns/security.md

exporters:
  - cursor
  - agents
```

## How remote sources are fetched and imported

When targeting a remote git source, both for copied sources (`aligntrue add`) and linked sources (in `config.yaml`):

- **Folder support**: Target files OR directories - when a directory is targeted, all `.md` and `.mdc` files are found recursively (e.g., `backend/security.md`)
- **Recursive scanning**: All `.md` and `.mdc` files in subdirectories are included (e.g., `rules/backend/caching.md`, `rules/frontend/react.md`)
- **Structure preservation**: Directory structure is maintained (e.g., `backend/security.md` stays `backend/security.md`)
- **Format conversion**: `.mdc` files are converted to `.md` format automatically during import
- **Metadata tracking**: Source URL is recorded in rule frontmatter for reference

**Example:**

Remote structure:

```
https://github.com/company/rules/
├── security.md
├── backend/
│   ├── caching.md
│   └── performance.md
└── frontend/
    └── react.md
```

After `aligntrue add https://github.com/company/rules`:

```
.aligntrue/rules/
├── security.md
├── backend/
│   ├── caching.md
│   └── performance.md
└── frontend/
    └── react.md
```

## Selective import when adding rules

When importing rules via `aligntrue init`, `aligntrue add`, or `aligntrue sources detect --import`, AlignTrue shows an intelligent selection interface:

### Single file

Auto-imported without prompts:

```
Importing 1 rule from .cursor/rules/testing.mdc
```

### Small folder (2-10 files)

Shows the file list with a quick confirm:

```
Found 4 files in .cursor/rules/:
  testing.mdc
  debugging.mdc
  typescript.mdc
  security.mdc

Import all? (Y/n) _
```

Press `Y` to import all, or `n` to select individually.

### Large or multiple folders

Shows a summary, then offers folder-level selection if you say no:

```
Found 28 files in 3 folders

Import all? (Y/n) _
```

If you select no, you can toggle which folders to import using the space bar.

### Non-interactive mode

In CI or with `--yes`, all detected files are imported automatically for consistency.

## Single vs. multiple files per source

### One file per git source (backward compatible)

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    path: aligns/security.md
```

### Multiple files from same source (new syntax)

```yaml
sources:
  - type: git
    include:
      - https://github.com/company/rules/aligns/security.md
      - https://github.com/company/rules/aligns/typescript.md
      - https://github.com/company/rules/aligns/testing.md
```

Much cleaner and avoids repetition!

## Understanding sync precedence

When `aligntrue sync` runs, you'll see a summary of your sources:

```
Sources (highest priority first):
  1. .aligntrue/rules/ (local) - Your rules
  2. github.com/company/standards@v2 - 8 rules
  3. github.com/team/extras - 3 rules

Total: 23 rules (2 conflicts resolved by priority)
```

**What this means:**

- Your local rules always win
- External rules are applied in order
- Conflicts are resolved automatically (highest priority source wins)

## Customizing external rules

You can't edit external rules directly, but you can customize them:

### Using plugs (fill template slots)

External rules often include template slots:

```yaml
# .aligntrue/config.yaml
plugs:
  fills:
    test.cmd: "pnpm test"
    docs.url: "https://docs.example.com"
```

### Using overlays (modify rules)

Adjust severity, add checks, or remove properties:

```yaml
# .aligntrue/config.yaml
overlays:
  overrides:
    - selector: "rule[id=no-console]"
      set:
        severity: "warn"
    - selector: "rule[id=max-line-length]"
      set:
        check:
          inputs:
            max: 120
```

Both plugs and overlays work on external rules just like local rules.

## Removing sources

To stop using a source, simply remove it from your config and sync:

```yaml
# Before
sources:
  - type: git
    include:
      - https://github.com/company/old-rules

# After (removed)
sources: []

# Run sync
aligntrue sync
```

Your rules will update automatically. The removed source's rules are no longer included.

## Practical examples

### Combine base standards with team-specific rules

```yaml
sources:
  - type: git
    include:
      - https://github.com/company/standards@v1 # Company baseline
      - https://github.com/team/frontend-rules # Team customizations
```

Your local `.aligntrue/rules/` can add project-specific rules that override both.

### Use a specific version of shared rules

```yaml
sources:
  - type: git
    include:
      - https://github.com/company/rules@v2.0.0/aligns/security.md
      - https://github.com/company/rules@v2.0.0/aligns/testing.md
```

Pinning versions ensures everyone on your team uses the same rules.

### Mix of remote and local customization

```yaml
sources:
  - type: git
    include:
      - https://github.com/AlignTrue/community-rules/aligns
# Then in .aligntrue/rules/:
# - Add local/security.md (overrides community rules on conflict)
# - Add local/project-specific.md (new rules not in community aligns)
```

## Troubleshooting

### "Source file not found"

Check:

1. URL is correct (case-sensitive)
2. Repository exists and is accessible
3. Branch/tag exists if using `@ref`
4. Path is correct (file or directory exists)

Example error:

```
Error: File not found: aligns/typo.md
  Available files in aligns/:
    - security.md
    - testing.md
  Did you mean: aligns/security.md
```

### "Git ref not found"

```
Error: Git reference not found
  URL: https://github.com/company/rules
  Ref: v3.0.0

  Available branches/tags:
    - main
    - develop
    - v2.0.0
    - v2.1.0
```

Use `main`, `develop`, or an available tag.

### Network errors

```
Error: Could not fetch source
  URL: https://github.com/company/rules
  Reason: Network unreachable
```

- Check internet connection
- Verify URL is accessible
- Use `aligntrue sync --offline` to use cached sources

### Private repositories

For SSH URLs, ensure SSH key is configured:

```bash
ssh-add ~/.ssh/id_ed25519
ssh -T git@github.com  # Test connection
```

For HTTPS, use git credential helper or personal access tokens.

## How external rules are stored

External git sources are cached locally for performance:

```
.aligntrue/.cache/git/
  {repo-hash}/
    .git/              # Git repository data
    security.md        # Extracted file
```

Cache is git-ignored by default. Run `aligntrue sync --offline` to use cached sources without network.

## See also

- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical details of merging and precedence
- [Plugs](/docs/02-customization/plugs) - Fill template slots in rules
- [Overlays](/docs/02-customization/overlays) - Customize rule properties
- [Scopes](/docs/02-customization/scopes) - Path-based rule application in monorepos
