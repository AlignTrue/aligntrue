---
description: Essential daily commands for AlignTrue workflow
---

# Core commands

The foundation of your AlignTrue workflow. These commands handle initialization, syncing, validation, and monitoring.

## `aligntrue init`

Initialize AlignTrue in a project with smart detection of existing rules and agent files.

**Usage:**

```bash
aligntrue init [options]
```

**Options:**

| Flag                | Alias | Description                                                     | Default     |
| ------------------- | ----- | --------------------------------------------------------------- | ----------- |
| `--non-interactive` | `-n`  | Run without prompts (uses defaults)                             | `false`     |
| `--yes`             | `-y`  | Same as --non-interactive                                       | `false`     |
| `--no-sync`         |       | Skip automatic sync after initialization                        | `false`     |
| `--mode`            |       | Operating mode: `solo` or `team`                                | `solo`      |
| `--exporters`       |       | Comma-separated list of exporters (skips interactive selection) | Auto-detect |
| `--source`          |       | Import rules from URL or path (skips auto-detect)               | Auto-detect |
| `--link`            |       | Keep source connected for ongoing updates (use with --source)   | `false`     |
| `--ref`             |       | Git ref (branch/tag/commit) for git sources                     | `main`      |

**What it does:**

1. Detects existing rules in agent-specific folders (`.cursor/`, `AGENTS.md`, etc.)
2. Prompts to import or create starter templates
3. Handles duplicate/similar files with smart overlap detection
4. Selects exporters (agents to export to)
5. Creates `.aligntrue/config.yaml` and `.aligntrue/rules/`
6. Auto-syncs to configured agents (unless `--no-sync`)

**Examples:**

```bash
# Interactive initialization with agent detection
aligntrue init

# Non-interactive with defaults
aligntrue init --yes

# Initialize with external rules
aligntrue init --source https://github.com/org/rules

# Import and keep source connected
aligntrue init --source https://github.com/org/rules --link

# Team mode with lockfile
aligntrue init --mode team --yes
```

**Example output:**

```
✓ AlignTrue Init
✓ Agent detection complete (found Cursor, VS Code, Claude)
✓ Config created: .aligntrue/config.yaml
✓ Rules directory: .aligntrue/rules/ (5 rules)
✓ Syncing to 3 agents...
✓ Exported to: .cursor/rules/, AGENTS.md, CLAUDE.md

AlignTrue initialized and synced
Helpful commands:
  aligntrue sync        Sync rules to your agents
  aligntrue exporters   Manage agent formats
  aligntrue status      Check sync health
```

**Exit codes:**

- `0` - Success
- `1` - User cancelled
- `2` - System error (permissions, invalid config)

---

## `aligntrue sync`

Sync rules from `.aligntrue/rules/` to configured agents. This is your primary workflow command.

**Usage:**

```bash
aligntrue sync [options]
```

**Options:**

| Flag                  | Alias | Description                                   | Default                  |
| --------------------- | ----- | --------------------------------------------- | ------------------------ |
| `--dry-run`           |       | Preview changes without writing files         | `false`                  |
| `--force`             |       | Force overwrite files even with local changes | `false`                  |
| `--offline`           |       | Offline mode: use cache, no network calls     | `false`                  |
| `--verbose`           | `-v`  | Show detailed output and fidelity notes       | `false`                  |
| `--verbose`           | `-vv` | Full verbosity (files, warnings, details)     | `false`                  |
| `--quiet`             | `-q`  | Minimal output (errors only)                  | `false`                  |
| `--json`              |       | Machine-readable JSON output                  | `false`                  |
| `--force-refresh`     |       | Bypass cache TTL for git sources              | `false`                  |
| `--skip-update-check` |       | Skip git source updates, use cache only       | `false`                  |
| `--no-detect`         |       | Skip agent detection                          | `false`                  |
| `--auto-enable`       |       | Auto-enable detected agents without prompting | `false`                  |
| `--config`            | `-c`  | Custom config file path                       | `.aligntrue/config.yaml` |
| `--clean`             |       | Remove exported files with no matching rule   | `false`                  |

**What it does:**

1. Loads rules from `.aligntrue/rules/` (your source of truth)
2. Fetches any linked git sources (with caching)
3. Builds internal representation (IR)
4. Detects agents in workspace
5. Exports rules to each configured agent format
6. Creates backup before overwriting files
7. Validates lockfile/bundle in team mode

**Examples:**

```bash
# Standard sync
aligntrue sync

# Preview changes before committing
aligntrue sync --dry-run

# Force overwrite (use carefully)
aligntrue sync --force

# Verbose output to see all files
aligntrue sync --verbose

# Full verbosity for debugging
aligntrue sync -vv

# Offline mode (no git updates)
aligntrue sync --offline

# JSON output for CI/scripting
aligntrue sync --json

# Sync with auto-enable for new agents
aligntrue sync --auto-enable
```

**Example output:**

```
✓ AlignTrue Sync

Syncing rules to 3 agents
  ✓ cursor          .cursor/rules/ (5 files)
  ✓ agents          AGENTS.md (1 file)
  ✓ claude          CLAUDE.md (1 file)

✓ Sync complete (2 seconds)
  Rules: 5
  Exported: 3 agents
  Backup: .aligntrue/.backups/sync-2025-01-15-14-32-00
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (schema, lockfile drift)
- `2` - System error (missing files, permissions)

**See also:** [Automating sync](/docs/01-guides/07-ci-cd-integration#automating-sync) for pre-commit hooks and editor integration

---

## `aligntrue check`

Validate rules, configuration, and lockfile consistency. Use in CI/CD pipelines.

**Usage:**

```bash
aligntrue check [options]
```

**Options:**

| Flag       | Alias | Description                              | Default                  |
| ---------- | ----- | ---------------------------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path                  | `.aligntrue/config.yaml` |
| `--ci`     |       | CI mode (disables interactive output)    | `false`                  |
| `--json`   |       | Output validation results in JSON format | `false`                  |

**What it does:**

1. Validates config file exists and loads
2. Validates all exporters are recognized
3. Validates rules schema (markdown or YAML)
4. Validates lockfile if team mode enabled
5. Validates overlays (if present)
6. Warns on file organization issues

**Examples:**

```bash
# Check rules locally
aligntrue check

# CI mode with JSON output
aligntrue check --ci --json

# Check with custom config
aligntrue check --config ./config.yaml
```

**Example output:**

```
✓ Validation passed

  Schema: .aligntrue/rules/ is valid
  Lockfile: .aligntrue.lock.json matches current rules
  Overlays: 2 overlay(s) validated
```

**Exit codes:**

- `0` - All validations passed
- `1` - Validation error (schema, lockfile mismatch)
- `2` - System error (missing files)

---

## `aligntrue status`

Display current workspace health at a glance: mode, exporters, sync status, and rules count.

**Usage:**

```bash
aligntrue status [options]
```

**Options:**

| Flag       | Alias | Description                          | Default                  |
| ---------- | ----- | ------------------------------------ | ------------------------ |
| `--config` | `-c`  | Custom config file path              | `.aligntrue/config.yaml` |
| `--json`   |       | Output status summary in JSON format | `false`                  |

**What it shows:**

- Active mode (solo/team)
- Configured exporters and detection status
- Last sync timestamp
- Rule files and counts
- Lockfile/bundle status
- Missing or unused agents

**Examples:**

```bash
# Show status
aligntrue status

# JSON output for scripting
aligntrue status --json
```

**Example output:**

```
AlignTrue Status
================

Mode: SOLO
Config: .aligntrue/config.yaml
Last sync: Today at 2:34 PM (5 minutes ago)

Exporters (3 configured):
  ✓ cursor       Cursor
  ✓ agents       AGENTS.md
  ✓ claude       Claude Code

Rules:
  Directory: .aligntrue/rules/
  Files: 5 .md file(s)
    - global.md (global, 3 sections)
    - typescript.md (3 sections)
    - testing.md (3 sections)

Lockfile:
  Status: disabled

Bundle:
  Status: disabled
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

---

## `aligntrue doctor`

Run health checks to diagnose workspace issues and verify configuration.

**Usage:**

```bash
aligntrue doctor [options]
```

**Options:**

| Flag       | Alias | Description                         | Default                  |
| ---------- | ----- | ----------------------------------- | ------------------------ |
| `--config` | `-c`  | Custom config file path             | `.aligntrue/config.yaml` |
| `--json`   |       | Output doctor report in JSON format | `false`                  |

**Checks performed:**

- Config file presence and validity
- Rules file presence and size
- Lockfile presence (if team mode)
- Bundle presence (if enabled)
- Exporter outputs exist
- Agent detection vs configuration
- File permissions

**Examples:**

```bash
# Run health check
aligntrue doctor

# JSON output for automation
aligntrue doctor --json

# Diagnose specific config
aligntrue doctor --config ./custom/config.yaml
```

**Example output:**

```
AlignTrue Health Check

✓ Config file (.aligntrue/config.yaml)
✓ Config valid (mode: solo)
✓ Rules file (.aligntrue/rules/)
✓ Exporter: cursor (.cursor/rules/ detected)
✓ Exporter: agents (AGENTS.md detected)
✓ Exporter: claude (CLAUDE.md detected)

Checks: 6 ok, 0 warnings, 0 errors

✓ All systems go
```

**Exit codes:**

- `0` - All checks passed
- `1` - Warnings or errors found
- `2` - System error (permissions, missing config)

**See also:** [Status command](#aligntrue-status) for workspace overview

---

## Quick reference

| Command  | Purpose                | When to use            |
| -------- | ---------------------- | ---------------------- |
| `init`   | Set up AlignTrue       | First time setup       |
| `sync`   | Export rules to agents | After editing rules    |
| `check`  | Validate rules         | Before committing      |
| `status` | View workspace health  | Troubleshooting        |
| `doctor` | Run diagnostics        | Troubleshooting issues |
