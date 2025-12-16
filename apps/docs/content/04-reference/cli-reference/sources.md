---
description: Manage rule sources and imports
---

# Sources

Commands for adding and managing rule sources from git repositories and local paths.

## `aligntrue add`

Add rules from a git repository or local path. Default: copy rules to `.aligntrue/rules/`. Use `add source` subcommand to keep git sources connected for ongoing updates.

**Usage:**

```bash
aligntrue add <git-url|path> [options]
```

**Arguments:**

- `<git-url|path>` - Git URL (HTTPS/SSH), or local path (e.g., `https://github.com/org/rules`, `./path/to/rules`)

**Options:**

| Flag        | Alias | Description                                   | Default                  |
| ----------- | ----- | --------------------------------------------- | ------------------------ |
| `--ref`     |       | Git ref: branch, tag, or commit SHA           | `main`                   |
| `--path`    |       | Path to rules within repository               | Root                     |
| `--yes`     | `-y`  | Non-interactive mode (keep both on conflicts) | `false`                  |
| `--no-sync` |       | Skip auto-sync after import                   | `false`                  |
| `--config`  | `-c`  | Custom config file path                       | `.aligntrue/config.yaml` |

**Modes:**

**Default mode (copy rules):**

- Copies rules to `.aligntrue/rules/` (one-time import)
- Rules become your local copy
- Source is not tracked

**With `source` subcommand (track source):**

- Use `aligntrue add source <url>` instead
- Adds source to config for ongoing updates
- Rules sync with source on each `aligntrue sync`

**Examples:**

```bash
# Copy rules locally
aligntrue add https://github.com/org/rules

# Copy from local path
aligntrue add ./path/to/rules

# Keep source connected for updates (use add source)
aligntrue add source https://github.com/org/rules

# Pin to specific version (one-time copy)
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

**Exit codes:**

- `0` - Success
- `1` - Invalid URL, failed import
- `2` - System error (permissions, disk space)

**See also:** [Remove command](#aligntrue-remove) to remove sources

---

## `aligntrue add source`

Keep a git source connected for ongoing updates on each `aligntrue sync`.

**Usage:**

```bash
aligntrue add source <git-url> [options]
```

**Arguments:**

- `<git-url>` - Git URL (HTTPS/SSH), e.g., `https://github.com/org/rules`

**Options:**

| Flag         | Alias | Description                          | Default                  |
| ------------ | ----- | ------------------------------------ | ------------------------ |
| `--ref`      |       | Git ref: branch, tag, or commit SHA  | `main`                   |
| `--path`     |       | Path to rules within repository      | Root                     |
| `--personal` |       | Write to personal config (team mode) | `false`                  |
| `--shared`   |       | Write to team config (team mode)     | `false`                  |
| `--yes`      | `-y`  | Non-interactive mode                 | `false`                  |
| `--config`   | `-c`  | Custom config file path              | `.aligntrue/config.yaml` |

**What it does:**

1. Adds the git source to config (`config.yaml` or `config.team.yaml`).
2. Fetches rules on each `aligntrue sync` using cache + updates.
3. Prompts for consent on first network access.

**Examples:**

```bash
# Connect a shared source
aligntrue add source https://github.com/org/rules

# Pin to tag
aligntrue add source https://github.com/org/rules --ref v2.0.0

# Team mode: write to personal config
aligntrue add source https://github.com/org/rules --personal
```

**Exit codes:** `0` success, `1` invalid URL, `2` system error

---

## `aligntrue add remote`

Add a push destination for your rules repository (team workflows).

**Usage:**

```bash
aligntrue add remote <git-url> [options]
```

**Arguments:**

- `<git-url>` - Git URL (HTTPS/SSH)

**Options:**

| Flag         | Alias | Description              | Default                  |
| ------------ | ----- | ------------------------ | ------------------------ |
| `--personal` |       | Write to personal config | `false`                  |
| `--shared`   |       | Write to team config     | `false`                  |
| `--config`   | `-c`  | Custom config file path  | `.aligntrue/config.yaml` |

**What it does:**

1. Adds the remote to the selected config (personal or team).
2. Used by workflows that push rules to a central repo.

**Examples:**

```bash
# Add shared remote
aligntrue add remote git@github.com:org/aligntrue-rules.git

# Personal remote
aligntrue add remote git@github.com:me/aligntrue-rules.git --personal
```

**Exit codes:** `0` success, `1` invalid URL, `2` system error

---

## `aligntrue remove source`

Remove a linked source from your configuration.

**Usage:**

```bash
aligntrue remove source <url> [options]
```

**Arguments:**

- `<url>` - The git URL to remove (must match exactly as configured)

**Options:**

| Flag       | Alias | Description                               | Default                  |
| ---------- | ----- | ----------------------------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path                   | `.aligntrue/config.yaml` |
| `--yes`    | `-y`  | Non-interactive mode (skip confirmations) | `false`                  |

**What it does:**

1. Finds the source in config
2. Removes it from sources array
3. Saves config atomically
4. (Does NOT delete copied rules from `.aligntrue/rules/`)

**Examples:**

```bash
# Remove a source
aligntrue remove source https://github.com/org/rules

# Non-interactive removal (CI)
aligntrue remove source https://github.com/org/rules --yes

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
# Add as connected source
aligntrue add source https://github.com/org/rules

# Later, see what changed
aligntrue sources status

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
