---
description: Manage rule sources and imports
---

# Sources

Commands for adding and managing rule sources from git repositories, local paths, and remote URLs.

## `aligntrue add`

Add rules from a git repository or local path. Default: copy rules to `.aligntrue/rules/`. With `--link`: keep source connected for ongoing updates.

**Usage:**

```bash
aligntrue add <git-url|path> [options]
```

**Arguments:**

- `<git-url|path>` - Git URL (HTTPS/SSH), or local path (e.g., `https://github.com/org/rules`, `./path/to/rules`)

**Options:**

| Flag        | Alias | Description                                                | Default                  |
| ----------- | ----- | ---------------------------------------------------------- | ------------------------ |
| `--link`    |       | Keep source connected for ongoing updates (adds to config) | `false`                  |
| `--ref`     |       | Git ref: branch, tag, or commit SHA                        | `main`                   |
| `--path`    |       | Path to rules within repository                            | Root                     |
| `--yes`     | `-y`  | Non-interactive mode (keep both on conflicts)              | `false`                  |
| `--no-sync` |       | Skip auto-sync after import                                | `false`                  |
| `--config`  | `-c`  | Custom config file path                                    | `.aligntrue/config.yaml` |

**Modes:**

**Default mode (copy rules):**

- Copies rules to `.aligntrue/rules/` (one-time import)
- Rules become your local copy
- Source is not tracked

**With `--link` mode (track source):**

- Adds source to config for ongoing updates
- Rules sync with source on each `aligntrue sync`
- Automatically detects drift

**Examples:**

```bash
# Copy rules locally
aligntrue add https://github.com/org/rules

# Copy from local path
aligntrue add ./path/to/rules

# Keep source connected for updates
aligntrue add https://github.com/org/rules --link

# Pin to specific version
aligntrue add https://github.com/org/rules --ref v2.0.0

# From subdirectory in repo
aligntrue add https://github.com/org/repo --path rules/typescript

# Non-interactive copy
aligntrue add https://github.com/org/rules --yes --no-sync
```

**Example output (copy mode):**

```
✓ Imported 5 rules from https://github.com/org/rules

Files created:
  .aligntrue/rules/global.md
  .aligntrue/rules/typescript.md
  .aligntrue/rules/testing.md

Tips:
  • To keep private: add '.aligntrue/rules/' to .gitignore
  • To remove: delete the files and run 'aligntrue sync'
  • To apply to agents: run 'aligntrue sync'

Done
```

**Example output (link mode):**

```
✓ Linked https://github.com/org/rules

Vendor path: vendor/org-rules
Vendor type: submodule
Profile: org/typescript-rules

Next steps:
  aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Invalid URL, failed import
- `2` - System error (permissions, disk space)

**See also:** [Remove command](#aligntrue-remove) to remove sources

---

## `aligntrue remove`

Remove a linked source from your configuration.

**Usage:**

```bash
aligntrue remove <url> [options]
```

**Arguments:**

- `<url>` - The git URL to remove (must match exactly as configured)

**Options:**

| Flag       | Alias | Description             | Default                  |
| ---------- | ----- | ----------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path | `.aligntrue/config.yaml` |

**What it does:**

1. Finds the source in config
2. Removes it from sources array
3. Saves config atomically
4. (Does NOT delete copied rules from `.aligntrue/rules/`)

**Examples:**

```bash
# Remove a source
aligntrue remove https://github.com/org/rules

# Then sync to apply changes
aligntrue sync

# Verify removal
aligntrue status
```

**Exit codes:**

- `0` - Success
- `1` - Source not found, invalid URL
- `2` - System error (file write)

---

## `aligntrue sources`

Manage all rule sources: list, check status, detect updates, and pin versions.

**Usage:**

```bash
aligntrue sources <subcommand> [options]
```

**Subcommands:**

| Command  | Purpose                         |
| -------- | ------------------------------- |
| `list`   | Show all configured sources     |
| `status` | Detailed status with cache info |
| `detect` | Find untracked agent files      |
| `update` | Force refresh git sources       |
| `pin`    | Pin source to specific version  |

---

### `aligntrue sources list`

Show all configured sources with their types and paths.

**Usage:**

```bash
aligntrue sources list [options]
```

**Options:**

| Flag       | Alias | Description             | Default                  |
| ---------- | ----- | ----------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path | `.aligntrue/config.yaml` |

**Example output:**

```
Configured sources:
  1. .aligntrue/rules/ (local)
  2. https://github.com/company/standards (git)
  3. https://github.com/team/extras@v2.0.0 (git - pinned)

Total: 3 sources
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources status`

Detailed status of all sources including cache info, last fetch time, and SHA.

**Usage:**

```bash
aligntrue sources status [options]
```

**Options:**

| Flag       | Alias | Description             | Default                  |
| ---------- | ----- | ----------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path | `.aligntrue/config.yaml` |

**Example output:**

```
Source status:

https://github.com/company/rules
  Cache: .aligntrue/.cache/git/abc123...
  Cached SHA: abc1234567890def
  Last fetched: 2025-01-15T10:30:00Z
  Cache status: Valid

https://github.com/team/extras@v2.0.0
  Cache: .aligntrue/.cache/git/def456...
  Cached SHA: v2.0.0 (pinned tag)
  Last fetched: 2025-01-14T15:20:00Z
  Cache status: Valid
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources detect`

Find agent files not tracked by AlignTrue (untracked rules in `.cursor/`, `AGENTS.md`, etc.).

**Usage:**

```bash
aligntrue sources detect [options]
```

**Options:**

| Flag       | Alias | Description                                       | Default                  |
| ---------- | ----- | ------------------------------------------------- | ------------------------ |
| `--import` |       | Auto-import detected files to `.aligntrue/rules/` | `false`                  |
| `--yes`    | `-y`  | Auto-confirm prompts in non-interactive mode      | `false`                  |
| `--config` | `-c`  | Custom config file path                           | `.aligntrue/config.yaml` |

**Examples:**

```bash
# List untracked files
aligntrue sources detect

# Import detected files
aligntrue sources detect --import

# Non-interactive import
aligntrue sources detect --import --yes
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

### `aligntrue sources update`

Force refresh git sources, bypassing cache TTL (time-to-live).

**Usage:**

```bash
aligntrue sources update <url|--all> [options]
```

**Arguments:**

- `<url>` - Update specific source, OR
- `--all` - Update all git sources

**Options:**

| Flag       | Alias | Description             | Default                  |
| ---------- | ----- | ----------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path | `.aligntrue/config.yaml` |

**What it does:**

1. Clears cache for specified source(s)
2. Fetches fresh copy from git
3. Updates local cache with new SHA
4. Does NOT run sync (you must run `aligntrue sync` manually)

**Examples:**

```bash
# Update specific source
aligntrue sources update https://github.com/company/rules

# Update all git sources
aligntrue sources update --all

# Then sync to pull updated rules
aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Source not found, network error
- `2` - System error

---

### `aligntrue sources pin`

Pin a git source to a specific commit, branch, or tag. Prevents accidental updates to a different version.

**Usage:**

```bash
aligntrue sources pin <url> <ref> [options]
```

**Arguments:**

- `<url>` - The git source URL
- `<ref>` - Commit SHA, branch name, or tag (e.g., `v1.3.0`, `main`, `abc1234567890def`)

**Options:**

| Flag       | Alias | Description             | Default                  |
| ---------- | ----- | ----------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path | `.aligntrue/config.yaml` |

**What it does:**

1. Updates source ref in config
2. Clears cache to fetch new version
3. Does NOT run sync (you must run `aligntrue sync` manually)

**Examples:**

```bash
# Pin to tag
aligntrue sources pin https://github.com/company/rules v1.3.0

# Pin to specific commit
aligntrue sources pin https://github.com/company/rules abc1234567890def

# Pin to branch
aligntrue sources pin https://github.com/company/rules main

# Then sync to pull the pinned version
aligntrue sync

# Verify pinned version
aligntrue sources status
```

**Exit codes:**

- `0` - Success
- `1` - Source not found, invalid ref
- `2` - System error

---

## Workflow examples

### Import rules once

```bash
# Copy rules locally
aligntrue add https://github.com/org/rules

# Verify imported
aligntrue status

# Sync to agents
aligntrue sync
```

### Keep source connected

```bash
# Add with --link to stay connected
aligntrue add https://github.com/org/rules --link

# Later, see what changed
aligntrue sources status

# Force check for updates
aligntrue sources update https://github.com/org/rules

# Sync (pulls updated rules)
aligntrue sync
```

### Manage multiple sources

```bash
# List all sources
aligntrue sources list

# Pin one to v2.0.0
aligntrue sources pin https://github.com/company/rules v2.0.0

# Update others
aligntrue sources update https://github.com/team/extras

# Sync everything
aligntrue sync
```

---

## See also

- [Init command](/docs/04-reference/cli-reference/core#aligntrue-init) for initial setup with sources
- [Sync command](/docs/04-reference/cli-reference/core#aligntrue-sync) to apply source updates to agents
- [Git workflows guide](/docs/03-concepts/git-workflows) for complete workflow documentation
