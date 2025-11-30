# Basic commands

Commands you'll use most often for day-to-day development.

## `aligntrue init`

Set up AlignTrue in your project with automatic agent detection and import support.

**Usage:**

```bash
aligntrue init [options]
```

**Flags:**

| Flag                 | Description                                       | Default |
| -------------------- | ------------------------------------------------- | ------- |
| `--yes`, `-y`        | Non-interactive mode (uses defaults)              | `false` |
| `--exporters <list>` | Comma-separated list of exporters                 | -       |
| `--source <url>`     | Import rules from URL or path (skips auto-detect) | -       |
| `--link`             | Keep source connected for ongoing updates         | `false` |
| `--ref <ref>`        | Git ref (branch/tag/commit) for git sources       | -       |
| `--mode <mode>`      | Operating mode: solo (default) or team            | `solo`  |
| `--no-sync`          | Skip automatic sync after initialization          | `false` |

**What it does:**

1. Detects AI coding agents in your workspace (Cursor, Copilot, Claude Code, etc.)
2. Creates `.aligntrue/config.yaml` with detected agents enabled
3. Creates `.aligntrue/rules` (internal IR) and `AGENTS.md` (primary user-editable file)
4. Auto-configures sync settings

**Interactive prompts:**

- **Agents detected** - Choose which agents to enable (auto-enables if ≤3 detected)
- **Create files?** - Confirm before writing

**Examples:**

```bash
# Interactive setup (auto-detect existing rules)
aligntrue init

# Non-interactive with defaults
aligntrue init --yes

# Import from external source (one-time copy)
aligntrue init --source https://github.com/org/rules

# Import and stay connected for updates
aligntrue init --source https://github.com/org/rules --link

# Import from local path
aligntrue init --source ./path/to/rules

# Specify exporters
aligntrue init --exporters cursor,agents,windsurf
```

**Exit codes:**

- `0` - Success
- `1` - Already initialized (shows guidance for team join vs re-init)
- `2` - System error (permissions, disk space, etc.)

**See also:**

- [Quickstart Guide](/docs/00-getting-started/00-quickstart) for step-by-step walkthrough
- [Adding rules](/docs/01-guides/11-adding-rules) for importing external rules

---

## `aligntrue add`

Add rules from a URL, git repository, or local path. By default, rules are copied to `.aligntrue/rules/` (one-time import).

**Usage:**

```bash
aligntrue add <url|path> [options]
```

**Flags:**

| Flag              | Description                                   | Default                  |
| ----------------- | --------------------------------------------- | ------------------------ |
| `--link`          | Keep source connected for ongoing updates     | `false`                  |
| `--ref <ref>`     | Git ref (branch/tag/commit) for git sources   | -                        |
| `--path <path>`   | Path to rules within repository               | -                        |
| `--yes`, `-y`     | Non-interactive mode (keep both on conflicts) | `false`                  |
| `--config <path>` | Custom config file path                       | `.aligntrue/config.yaml` |

**What it does:**

1. Fetches rules from the source (git, URL, or local path)
2. Converts to `.md` format with proper frontmatter
3. Adds `source` and `source_added` metadata
4. Copies to `.aligntrue/rules/`

**With `--link`:**

Instead of copying, adds the source to `config.yaml`. Rules are fetched on each `aligntrue sync`.

**Conflict handling:**

When a rule with the same filename exists:

- **Interactive:** Prompts for Replace (backup saved), Keep both, or Skip
- **Non-interactive (`--yes`):** Defaults to Keep both

**Examples:**

```bash
# Copy rules from GitHub (one-time)
aligntrue add https://github.com/org/rules

# Stay connected for updates
aligntrue add https://github.com/org/rules --link

# Pin to specific version
aligntrue add https://github.com/org/rules --ref v1.0.0

# Copy from local path
aligntrue add ./path/to/rules

# Non-interactive (keep both on conflicts)
aligntrue add https://github.com/org/rules --yes
```

**Exit codes:**

- `0` - Success
- `1` - Import failed
- `2` - System error

**See also:** [Adding rules](/docs/01-guides/11-adding-rules) for detailed workflows.

---

## `aligntrue remove`

Remove a linked source from your configuration.

**Usage:**

```bash
aligntrue remove <url>
```

**What it does:**

1. Finds the source in `config.yaml` that matches the URL
2. Removes it from the sources array
3. Saves the updated config

**Note:** This only removes linked sources from config. To remove copied rules, delete the files from `.aligntrue/rules/` and run `aligntrue sync`.

**Examples:**

```bash
# Remove a linked source
aligntrue remove https://github.com/org/rules
aligntrue sync  # Sync to update agent files
```

---

## `aligntrue sources`

Manage rule sources and organization.

**Usage:**

```bash
aligntrue sources <subcommand> [options]
```

**Subcommands:**

| Subcommand | Description                             |
| ---------- | --------------------------------------- |
| `list`     | List all configured sources             |
| `detect`   | Find untracked agent files in workspace |
| `split`    | Split AGENTS.md into multiple files     |

### `aligntrue sources list`

List all configured sources with details.

```bash
aligntrue sources list
```

**Output:**

```
Found 2 source(s) (priority order):

1. LOCAL
   Path: .aligntrue/rules
   Files: 5, Lines: 234

2. GIT
   URL: https://github.com/org/rules
   Ref: main
   Cache: available
```

### `aligntrue sources detect`

Find untracked agent files in your workspace.

```bash
# List untracked files
aligntrue sources detect

# Import them to .aligntrue/rules/
aligntrue sources detect --import
```

**Flags:**

| Flag       | Description                               | Default |
| ---------- | ----------------------------------------- | ------- |
| `--import` | Import detected files to .aligntrue/rules | `false` |
| `--yes`    | Skip confirmation prompts                 | `false` |

### `aligntrue sources split`

Split a large AGENTS.md file into multiple files in `.aligntrue/rules/`.

```bash
aligntrue sources split
aligntrue sources split --yes  # Non-interactive
```

**See also:** [Adding rules](/docs/01-guides/11-adding-rules) for complete workflows.

---

## `aligntrue sync`

Sync rules between your primary agent and all configured AI coding agents with automatic change detection.

**Usage:**

```bash
aligntrue sync [options]
```

**Flags:**

| Flag                    | Description                                               | Default                  |
| ----------------------- | --------------------------------------------------------- | ------------------------ |
| `--dry-run`             | Preview changes without writing files                     | `false`                  |
| `--force`               | Override performance limits and safety checks             | `false`                  |
| `--no-detect`           | Skip agent detection                                      | `false`                  |
| `--auto-enable`         | Auto-enable detected agents without prompting             | `false`                  |
| `--clean`               | Remove exported files with no matching source             | `false`                  |
| `--content-mode <mode>` | Export mode for single-file formats (auto, inline, links) | `auto`                   |
| `--config <path>`       | Custom config file path                                   | `.aligntrue/config.yaml` |

**Non-interactive modes:**

- `--yes` / `-y`: Auto-enables detected agents and auto-manages ignore files without prompting
- `--non-interactive` / `-n`: Skips all prompts but doesn't auto-enable agents

Use `--yes` in CI/automation workflows where you want full automation. Use `--non-interactive` if you only want to skip prompts without auto-enabling new agents.

See [Running sync in CI/automation](/docs/05-troubleshooting#running-sync-in-ciautomation) for CI examples.

**What it does:**

1. Loads configuration from `.aligntrue/config.yaml`
2. Detects new agents in workspace and prompts to enable them (unless `--no-detect` or `--yes`/`--non-interactive`)
3. Loads rules from `.aligntrue/rules/` directory
4. Generates agent-specific files (`.cursor/*.mdc`, `AGENTS.md`, etc.)
5. Updates lockfile (team mode only)

See [Sync behavior](/docs/03-concepts/sync-behavior) for details.

**Agent detection:**

Sync automatically detects new AI agents in your workspace by scanning for their files (e.g., `AGENTS.md`, `.windsurf/`, etc.). When a new agent is found, you'll be prompted:

```
⚠ New agent detected: Windsurf
  Found: .windsurf/rules.md

? Would you like to enable Windsurf?
  > Yes, enable and export
    No, skip for now
    Never ask about this agent
```

Responses:

- **Yes** - Adds agent to exporters and syncs rules
- **No** - Skips for now (asks again next time)
- **Never** - Adds to ignored list in config

Skip detection with `--no-detect` or auto-enable all detected agents with `--auto-enable`.

Configure behavior in `.aligntrue/config.yaml`:

```yaml
detection:
  auto_enable: false # Auto-enable without prompting
  ignored_agents: # Agents to never prompt about
    - windsurf
    - aider
```

**Examples:**

```bash
# Standard sync
aligntrue sync

# Skip agent detection
aligntrue sync --no-detect

# Auto-enable detected agents without prompting
aligntrue sync --auto-enable

# CI/automation: auto-enable agents and manage ignore files
aligntrue sync --yes

# CI/automation: skip prompts (doesn't auto-enable)
aligntrue sync --non-interactive

# Preview without writing
aligntrue sync --dry-run

# Force sync with safety overrides
aligntrue sync --force

# Remove stale exported files (no matching source)
aligntrue sync --clean

# Force inline content in AGENTS.md (embed full rules)
aligntrue sync --content-mode=inline

# Force links in AGENTS.md (even with single rule)
aligntrue sync --content-mode=links
```

**About `--content-mode`:**

The `--content-mode` flag is a one-time override for the current sync operation only. It does **not** persist to your config file.

- `auto` (default): Inline single rule, links for 2+ rules
- `inline`: Embed full rule content in AGENTS.md
- `links`: Use markdown links to `.aligntrue/rules/`

To make a mode persistent across all future syncs, use:

```bash
# Set persistent content mode in config
aligntrue config set sync.content_mode inline

# Then run sync (will use the configured mode)
aligntrue sync
```

For one-time override:

```bash
# This sync uses inline mode, but config remains unchanged
aligntrue sync --content-mode inline

# Next sync reverts to configured mode
aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (config not found, source missing, lockfile drift)
- `2` - System error (permissions, disk space, etc.)

**Team mode behavior:**

When `mode: team` is enabled in config:

- Validates lockfile before sync (soft/strict mode)
- Regenerates lockfile after successful sync
- Detects drift and suggests resolution

**See also:** [Sync Behavior](/docs/03-concepts/sync-behavior) for detailed contract.

---

## `aligntrue watch`

Watch agent files and automatically sync changes when you save.

**Usage:**

```bash
aligntrue watch [options]
```

**Flags:**

| Flag              | Description                          | Default |
| ----------------- | ------------------------------------ | ------- |
| `--debounce <ms>` | Delay in milliseconds before syncing | `500`   |
| `--help`, `-h`    | Show help                            | -       |

**What it does:**

1. Monitors configured agent files (e.g., `AGENTS.md`, `.cursor/rules/*.mdc`)
2. Detects file changes and new file additions
3. Trigger `aligntrue sync` automatically
4. Updates internal IR and other agents in real-time

**Requirements:**

- **Interactive Terminal (TTY):** Watch mode requires an interactive terminal session to run. It will not work in background processes or non-interactive CI environments.

**Examples:**

```bash
# Start watching with default settings
aligntrue watch

# Watch with longer debounce (1 second)
aligntrue watch --debounce 1000
```

**See also:** [File Watcher Setup](/docs/04-reference/file-watcher-setup) for more details.

---

## `aligntrue check`

Validate rules and lockfile without syncing. Great for CI/CD pipelines.

**Usage:**

```bash
aligntrue check [options]
```

**Flags:**

| Flag              | Description                             | Default                  |
| ----------------- | --------------------------------------- | ------------------------ |
| `--ci`            | Disable spinner/output for CI & scripts | `false`                  |
| `--config <path>` | Custom config file path                 | `.aligntrue/config.yaml` |

**What it validates:**

1. **Schema validation** - `.aligntrue/rules` matches JSON Schema
2. **Lockfile validation** - `.aligntrue.lock.json` matches current rules (team mode only)
3. **File organization** - Warns when rule files exceed 1500 lines and recommends `aligntrue sources split`

**Interactive vs CI modes:** By default `aligntrue check` shows spinner updates and friendly logs. Use `--ci` (or set `CI=true`) to run non-interactively—ideal for CI pipelines, git hooks, or any scripted invocation.

### Format detection

Check automatically detects file format:

- `.md` files → Natural markdown sections
- `.yaml`/`.yml` files → Pure YAML IR format

**Example:**

```bash
aligntrue check AGENTS.md          # Validates natural markdown
aligntrue check rules.yaml         # Validates YAML IR
```

**Examples:**

```bash
# Validate configuration (interactive)
aligntrue check

# Validate with custom config in CI
aligntrue check --ci --config .aligntrue/config.yaml

# Output JSON for parsing results
aligntrue check --ci --json
```

**Exit codes:**

- `0` - All checks pass
- `1` - Validation failed (schema errors, lockfile drift)
- `2` - System error (file not found, permissions, etc.)

**CI Integration:**

**Pre-commit hook:**

```bash
#!/bin/sh
# .git/hooks/pre-commit
aligntrue check --ci
```

**GitHub Actions:**

```yaml
- name: Validate AlignTrue rules
  run: |
    pnpm install
    aligntrue check --ci
```

**See also:** [Troubleshooting Guide](/docs/05-troubleshooting#check-issues-ci) for common check failures.

---

## `aligntrue backup`

Create, list, restore, and clean up backups of your `.aligntrue/` directory.

**Usage:**

```bash
aligntrue backup <subcommand>
```

**Subcommands:**

- `create` - Create a new backup
- `list` - List all available backups
- `restore` - Restore from a backup
- `cleanup` - Remove old backups

### `aligntrue backup create`

Create a manual backup of your `.aligntrue/` directory.

**Usage:**

```bash
aligntrue backup create [--notes "description"]
```

**Flags:**

| Flag             | Description                         | Default |
| ---------------- | ----------------------------------- | ------- |
| `--notes <text>` | Optional description for the backup | (none)  |

**What it does:**

1. Creates timestamped directory in `.aligntrue/.backups/<timestamp>/`
2. Copies all files from `.aligntrue/` (except `.cache/`, `.backups/`, telemetry)
3. Generates `manifest.json` with metadata
4. Displays backup timestamp and restore command

**Examples:**

```bash
# Basic backup
aligntrue backup create

# With notes
aligntrue backup create --notes "Before experimental changes"
aligntrue backup create --notes "Working state before refactor"
```

**Output:**

```
✔ Creating backup
✔ Backup created: 2025-10-29T14-30-00-000

Backed up 2 files:
  config.yaml
  .rules.yaml

Restore with: aligntrue backup restore --to 2025-10-29T14-30-00-000
```

### `aligntrue backup list`

List all available backups from newest to oldest.

**Usage:**

```bash
aligntrue backup list
```

**What it does:**

1. Scans `.aligntrue/.backups/` directory
2. Reads manifest from each backup
3. Displays backups sorted by timestamp (newest first)
4. Shows total count

**Example output:**

```
Available backups:

  2025-10-29T14-30-00-000
    Created: Oct 29, 2025 at 2:30:00 PM
    Files: 2 (config.yaml, .rules.yaml)
    Notes: Before experimental changes

  2025-10-29T12-15-45-123
    Created: Oct 29, 2025 at 12:15:45 PM
    Files: 3 (config.yaml, .rules.yaml, privacy-consent.json)
    Notes: Auto-backup before sync

3 backups found
```

### `aligntrue backup restore`

Restore files from a backup. Creates temporary backup before restore for safety.

**Usage:**

```bash
# Restore most recent backup
aligntrue backup restore

# Restore specific backup
aligntrue backup restore --to <timestamp>
```

**Flags:**

| Flag               | Description               | Default     |
| ------------------ | ------------------------- | ----------- |
| `--to <timestamp>` | Specific backup timestamp | Most recent |

**What it does:**

1. Creates temporary backup of current state (safety net)
2. Removes existing files in `.aligntrue/`
3. Copies files from backup
4. Validates restore success
5. Cleans up temporary backup

**Rollback behavior:**

If restore fails:

- Automatically restores from temporary backup
- Original state preserved
- Error message displayed

**Examples:**

```bash
# Restore most recent
aligntrue backup restore

# Restore specific backup (timestamp from `backup list`)
aligntrue backup restore --to 2025-10-29T14-30-00-000
```

**Output:**

```
✔ Creating temporary backup
✔ Restoring backup: 2025-10-29T14-30-00-000
✔ Restore complete

Restored 2 files:
  config.yaml
  .rules.yaml
```

**Warning:** This overwrites your current `.aligntrue/` directory. Use `backup list` to verify timestamp before restoring.

### `aligntrue backup cleanup`

Remove old backups based on age and retention configuration.

**Usage:**

```bash
# Clean up backups older than retention_days (from config)
aligntrue backup cleanup

# Clean up legacy .bak files from older versions
aligntrue backup cleanup --legacy
```

**Flags:**

| Flag       | Description                         | Default |
| ---------- | ----------------------------------- | ------- |
| `--legacy` | Scan and remove orphaned .bak files | (off)   |

**What it does:**

1. Lists all backups sorted by timestamp
2. Identifies backups older than `retention_days` from config
3. Applies `minimum_keep` safety floor (never removes more than necessary)
4. Prompts for confirmation
5. Removes old backup directories
6. Displays count removed and kept

**Examples:**

```bash
# Keep default number (from config)
aligntrue backup cleanup

# Remove legacy .bak files
aligntrue backup cleanup --legacy
```

**Example output:**

```
Will remove 3 backups older than 30 days

Keep minimum 3 most recent backups

Continue with cleanup? (yes/no): yes

✔ Cleanup complete
  Removed: 3 backups
  Kept: 5 backups
```

### Backup configuration

Configure backup retention in `.aligntrue/config.yaml`:

```yaml
backup:
  # Age-based retention (days)
  retention_days: 30 # Delete backups older than 30 days

  # Safety floor: always keep N most recent regardless of age
  minimum_keep: 3 # Always keep at least 3 backups
```

**Auto-backup workflow:**

Backups are created automatically before destructive operations:

1. Creates backup before operation
2. Displays backup timestamp
3. Executes operation
4. Cleans up old backups on success (if older than retention_days)

**Example with auto-backup:**

```bash
$ aligntrue sync

✔ Creating backup
✔ Backup created: 2025-10-29T14-30-00-000
  Restore with: aligntrue backup restore --to 2025-10-29T14-30-00-000

✔ Syncing to agents
✔ Wrote 3 files

✔ Cleaned up 2 old backups
```

**See also:** [Backup and Restore Guide](/docs/04-reference/backup-restore) for detailed usage and troubleshooting.

---

## `aligntrue status`

Show the current AlignTrue configuration, detected exporters, last sync time, and lockfile/bundle state.

**Usage:**

```bash
aligntrue status [--config path] [--json]
```

**Flags:**

| Flag           | Description                                        | Default                  |
| -------------- | -------------------------------------------------- | ------------------------ |
| `--config, -c` | Custom config file path                            | `.aligntrue/config.yaml` |
| `--json`       | Output machine-readable JSON instead of text table | `false`                  |
| `--help, -h`   | Show help                                          | -                        |

**What it shows:**

1. Mode, profile ID, and config path.
2. Exporters and whether their files were detected.
3. Lockfile/bundle enablement and whether the files exist.
4. Last sync timestamp (with relative age).

**Examples:**

```bash
# Human-readable summary
aligntrue status

# JSON for scripting
aligntrue status --json > status.json
```

---

## `aligntrue doctor`

Run health checks to confirm configuration, rules, exporter outputs, and team safeguards are healthy.

**Usage:**

```bash
aligntrue doctor [--config path] [--json]
```

**Flags:**

| Flag           | Description                         | Default                  |
| -------------- | ----------------------------------- | ------------------------ |
| `--config, -c` | Custom config file path             | `.aligntrue/config.yaml` |
| `--json`       | Output machine-readable JSON report | `false`                  |
| `--help, -h`   | Show help                           | -                        |

**What it checks:**

1. Config file exists and loads without validation errors.
2. `.aligntrue/rules` exists and is non-empty.
3. Each exporter’s output files exist (Cursor `.mdc`, `AGENTS.md`, MCP configs, etc.).
4. Lockfile/bundle files exist when modules are enabled.
5. Agent detection vs configured exporters (warns if agents are detected but not configured, or vice versa).

**Output:**

- Uses ✓ / ⚠ / ✗ for each check with detailed hints.
- JSON mode includes counts of ok/warn/error and absolute file paths for scripts.

**Examples:**

```bash
# Human-readable doctor report
aligntrue doctor

# Generate JSON report for CI artifacts
aligntrue doctor --json > doctor-report.json
```

**Exit codes:**

- `0` – All checks passed (warnings allowed).
- `1` – At least one check failed.
- `2` – System error (missing files that prevented doctor from running).
