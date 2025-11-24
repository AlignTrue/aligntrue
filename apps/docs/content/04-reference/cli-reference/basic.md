# Basic commands

Commands you'll use most often for day-to-day development.

## `aligntrue init`

Set up AlignTrue in your project with automatic agent detection and import support.

**Usage:**

```bash
aligntrue init [options]
```

**Flags:**

| Flag                 | Description                                 | Default |
| -------------------- | ------------------------------------------- | ------- |
| `--yes`, `-y`        | Non-interactive mode (uses defaults)        | `false` |
| `--project-id <id>`  | Project identifier (default: auto-detected) | -       |
| `--exporters <list>` | Comma-separated list of exporters           | -       |

**What it does:**

1. Detects AI coding agents in your workspace (Cursor, Copilot, Claude Code, etc.)
2. Creates `.aligntrue/config.yaml` with detected agents enabled
3. Creates `.aligntrue/.rules.yaml` (internal IR) and `AGENTS.md` (primary user-editable file)
4. Auto-configures sync settings

**Interactive prompts:**

- **Agents detected** - Choose which agents to enable (auto-enables if ≤3 detected)
- **Project ID** - Identifier for your project (used in rule IDs)
- **Create files?** - Confirm before writing

**Examples:**

```bash
# Interactive setup
aligntrue init

# Non-interactive with defaults
aligntrue init --yes

# Specify project ID
aligntrue init --project-id my-project

# Specify exporters
aligntrue init --exporters cursor,agents,windsurf
```

**Exit codes:**

- `0` - Success
- `1` - Already initialized (shows guidance for team join vs re-init)
- `2` - System error (permissions, disk space, etc.)

**See also:**

- [Quickstart Guide](/docs/00-getting-started/00-quickstart) for step-by-step walkthrough
- [Quickstart](/docs/00-getting-started/00-quickstart) to get started

---

## `aligntrue sync`

Sync rules between your primary agent and all configured AI coding agents with automatic change detection.

**Usage:**

```bash
aligntrue sync [options]
```

**Flags:**

| Flag                    | Description                                   | Default                  |
| ----------------------- | --------------------------------------------- | ------------------------ |
| `--dry-run`             | Preview changes without writing files         | `false`                  |
| `--force`               | Override performance limits and safety checks | `false`                  |
| `--accept-agent <name>` | Pull changes from agent back to IR            | -                        |
| `--no-auto-pull`        | Disable auto-pull for this sync               | `false`                  |
| `--show-auto-pull-diff` | Show full diff when auto-pull executes        | `false`                  |
| `--no-detect`           | Skip agent detection                          | `false`                  |
| `--auto-enable`         | Auto-enable detected agents without prompting | `false`                  |
| `--config <path>`       | Custom config file path                       | `.aligntrue/config.yaml` |

**Non-interactive modes:**

- `--yes` / `-y`: Auto-enables detected agents and auto-manages ignore files without prompting
- `--non-interactive` / `-n`: Skips all prompts but doesn't auto-enable agents

Use `--yes` in CI/automation workflows where you want full automation. Use `--non-interactive` if you only want to skip prompts without auto-enabling new agents.

See [Running sync in CI/automation](/docs/05-troubleshooting#running-sync-in-ciautomation) for CI examples.

**What it does:**

1. Loads configuration from `.aligntrue/config.yaml`
2. Detects new agents in workspace and prompts to enable them (unless `--no-detect` or `--yes`/`--non-interactive`)
3. Auto-pulls changes from primary agent (if enabled and no conflicts)
4. Shows diff summary of what changed during auto-pull
5. Parses rules from `.aligntrue/.rules.yaml` (internal IR)
6. Generates agent-specific files (`.cursor/*.mdc`, `AGENTS.md`, etc.)
7. Detects conflicts if multiple files were manually edited
8. Updates lockfile (team mode only)

**Auto-pull behavior:**

Auto-pull automatically imports changes from your primary agent before syncing. It runs when:

- `sync.auto_pull` is `true` in config (default for solo mode)
- Primary agent is configured (auto-detected on init)
- No conflicts detected between primary agent and other agent files

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

**Conflict detection:**

If multiple agent files were modified since last sync, you'll see:

```
⚠ Conflict detected:
  - You edited AGENTS.md (primary agent)
  - Changes also found in .cursor/rules/aligntrue.mdc

? How would you like to resolve this conflict?
  > Keep my edits to AGENTS.md (skip auto-pull)
    Accept changes from cursor and pull to AGENTS.md
    Abort sync and review manually
```

See [Resolving conflicts](/docs/05-troubleshooting/conflicts) for resolution strategies.

**Workflow modes:**

Configure your preferred workflow to avoid conflict prompts:

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "native_format" # auto | ir_source | native_format
```

See [Workflows guide](/docs/01-guides/01-workflows) for choosing your workflow.

**Examples:**

```bash
# Standard sync (with auto-pull if enabled)
aligntrue sync

# Disable auto-pull for this sync
aligntrue sync --no-auto-pull

# Show full diff of auto-pull changes
aligntrue sync --show-auto-pull-diff

# Skip agent detection
aligntrue sync --no-detect

# Auto-enable detected agents without prompting
aligntrue sync --auto-enable

# CI/automation: auto-enable agents and manage ignore files
aligntrue sync --yes

# CI/automation: skip prompts (doesn't auto-enable)
aligntrue sync --non-interactive

# Pull changes from agent to IR (manual)
aligntrue sync --accept-agent cursor

# Preview without writing
aligntrue sync --dry-run

# Pull changes from Cursor back to AGENTS.md
aligntrue sync --accept-agent cursor
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (config not found, source missing, lockfile drift)
- `2` - System error (permissions, disk space, etc.)

**Conflict resolution:**

If sync detects manual edits to generated files, you'll see:

```
⚠ Conflict detected in .cursor/rules/aligntrue.mdc

[i] Keep IR (discard manual edits)
[a] Accept agent (pull manual edits to AGENTS.md)
[d] Show diff
[q] Quit
```

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

1. **Schema validation** - `.aligntrue/.rules.yaml` matches JSON Schema
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

Remove old backups, keeping only the most recent N backups.

**Usage:**

```bash
# Use keep_count from config (default: 20)
aligntrue backup cleanup

# Keep specific number
aligntrue backup cleanup --keep 5
```

**Flags:**

| Flag              | Description               | Default           |
| ----------------- | ------------------------- | ----------------- |
| `--keep <number>` | Number of backups to keep | From config or 10 |

**What it does:**

1. Lists all backups sorted by timestamp
2. Identifies backups older than keep count
3. Prompts for confirmation
4. Removes old backup directories
5. Displays count removed and kept

**Examples:**

```bash
# Keep default number (from config)
aligntrue backup cleanup

# Keep only most recent 5
aligntrue backup cleanup --keep 5
```

**Example output:**

```
Found 12 backups (keeping 5 most recent)

Remove 7 old backups? (yes/no): yes

✔ Cleanup complete
  Removed: 7 backups
  Kept: 5 backups
```

### Auto-backup configuration

Enable automatic backups before destructive operations in `.aligntrue/config.yaml`:

```yaml
backup:
  # Enable auto-backup before operations
  auto_backup: false # Set to true to enable

  # Commands that trigger auto-backup
  backup_on:
    - sync
    - import
    - restore

  # Number of backups to keep (older ones auto-deleted)
  keep_count: 20
```

**Auto-backup workflow:**

When enabled, AlignTrue automatically:

1. Creates backup before operation
2. Displays backup timestamp
3. Executes operation
4. Cleans up old backups on success

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
3. Edit sources, auto-pull status, and primary agent.
4. Lockfile/bundle enablement and whether the files exist.
5. Last sync timestamp (with relative age).

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
2. `.aligntrue/.rules.yaml` exists and is non-empty.
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
