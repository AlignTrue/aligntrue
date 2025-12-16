---
title: External sources
description: Add, combine, and customize rules from git repositories and other sources. One-time imports or live-connected sources.
---

# External sources

Configure rules from external git repositories and sources. Add them as one-time imports or keep them connected to get automatic updates on every sync.

> **Getting started?** Start with [Adding rules](/docs/01-guides/04-external-sources#quick-start) below. Then read [Managing sources](/docs/01-guides/04-external-sources#managing-sources) for detailed configuration options.

## Quick start

### One-time import

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
- **Align packs:** Packs are created in the catalog UI only. Install via `aligntrue add <pack-id>` (or the catalog URL). Pack manifests are no longer supported. See [Align packs](/docs/03-concepts/align-packs).

### Connected sources (live updates)

Use `aligntrue add source` to add a connected source. Rules will be fetched on each `aligntrue sync`:

```bash
# Add as connected source (updates on sync)
aligntrue add source https://github.com/org/rules
```

**When to use connected sources:**

- Team standards that evolve over time
- Your personal rules stored in a separate repo
- Community rule packs you want to track

> **Team mode:** `aligntrue add source` and `aligntrue add remote` prompt for which config to update (personal vs. team). In non-interactive mode, pass `--personal` or `--shared`; otherwise the command errors.

### Quick reference

| Scenario                                | Command                             |
| --------------------------------------- | ----------------------------------- |
| New project, auto-detect existing rules | `aligntrue init`                    |
| New project, import from git repo       | `aligntrue init --source <git-url>` |
| Existing project, one-time import       | `aligntrue add <git-url>`           |
| Existing project, add as source         | `aligntrue add source <git-url>`    |
| Add push destination (remote)           | `aligntrue add remote <git-url>`    |
| Find untracked agent files              | `aligntrue sources detect`          |
| Import detected files                   | `aligntrue sources detect --import` |

## Auto-detect existing rules

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

## Managing sources

### How linked sources work

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

### Priority order

Rules merge in this order (highest to lowest priority):

```
1. Local rules (.aligntrue/rules/) ← ALWAYS FIRST, ALWAYS WINS
2. First external source listed
3. Second external source listed
4. ... (in order)
```

When the same rule appears in multiple sources, the first source wins. Your local rules always override external sources on conflict.

### Adding external sources

External sources use the new `include` syntax with fully-qualified URLs:

#### URL format

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

#### Configuration examples

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

### How remote sources are fetched and imported

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

### Selective import when adding rules

When importing rules via `aligntrue init`, `aligntrue add`, or `aligntrue sources detect --import`, AlignTrue uses one selection flow:

- Interactive: shows a checkbox list of detected files (all selected by default). You can deselect and proceed; conflicts prompt you to replace, keep both, or skip.
- Non-interactive (`--yes` or running without a TTY): imports everything it found and resolves filename conflicts by keeping both.

### Single vs. multiple files per source

**One file per git source (backward compatible):**

```yaml
sources:
  - type: git
    url: https://github.com/company/rules
    path: aligns/security.md
```

**Multiple files from same source (new syntax):**

```yaml
sources:
  - type: git
    include:
      - https://github.com/company/rules/aligns/security.md
      - https://github.com/company/rules/aligns/typescript.md
      - https://github.com/company/rules/aligns/testing.md
```

Much cleaner and avoids repetition!

### Understanding sync precedence

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

## Handling imports

### File format conversion

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

### Conflict handling

When importing rules that have the same filename as existing rules:

- Replace – overwrite and back up the existing file to `.aligntrue/.backups/files/` with a timestamped `.bak`
- Keep both – save the incoming rule under a unique name (for example, `typescript-1.md`)
- Skip – do not import the incoming rule

In non-interactive mode (`--yes`), conflicts automatically choose "keep both."

### Removing imported rules

#### Copied rules (default import)

Simply delete the files and sync:

```bash
rm .aligntrue/rules/unwanted-rule.md
aligntrue sync
```

#### Connected sources

Use the remove command:

```bash
aligntrue remove source https://github.com/org/rules
aligntrue sync
```

Your rules will update automatically. The removed source's rules are no longer included.

## Version pinning

For git sources, pin to a specific version:

```bash
# One-time import with version
aligntrue add https://github.com/org/rules --ref v1.0.0

# Add as connected source with version
aligntrue add source https://github.com/org/rules --ref v1.0.0

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

## Detecting untracked agent files

After initial setup, you may add new agent files manually or have team members who added rules without AlignTrue. Use `sources detect` to find them:

```bash
# List untracked agent files
aligntrue sources detect

# Import them to .aligntrue/rules/
aligntrue sources detect --import
```

**What you see:**

- Interactive: grouped list of detected agent files (Cursor, AGENTS, etc.). With `--import`, a selection UI lets you choose which files to import; conflicts still offer replace/keep both/skip.
- Non-interactive (`--yes`): `--import` imports everything it finds and defaults conflicts to keep both. Without `--import`, the command only lists files and exits.

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
# In each project, add as a connected source
aligntrue add source https://github.com/me/my-rules

# Update rules in your repo, then in any project:
aligntrue sync  # Pulls latest
```

### Team standards with local overrides

```bash
# Add team standards as a connected source
aligntrue add source https://github.com/company/standards

# Add local overrides in .aligntrue/rules/
# Local rules take precedence over linked sources
```

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
# - Add local/project-specific.md (new rules not in community Aligns)
```

## How import works

When you use `aligntrue add` or `aligntrue init --source`, the import process:

- **Pack manifests removed:** CLI no longer resolves `.align.yaml`. Import pulls markdown/XML files directly.
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

- [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy) - Publishing rules, controlling visibility, scope-based routing
- [Sync behavior](/docs/03-concepts/sync-behavior) - Technical details of merging and precedence
- [Plugs](/docs/02-customization/plugs) - Fill template slots in rules
- [Overlays](/docs/02-customization/overlays) - Customize rule properties
- [Scopes](/docs/02-customization/scopes) - Path-based rule application in monorepos
