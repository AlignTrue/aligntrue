# Command reference

Complete reference for all AlignTrue CLI commands.

## Basic commands

Commands you'll use most often for day-to-day development.

### `aligntrue init`

Set up AlignTrue in your project with automatic agent detection.

**Usage:**

```bash
aligntrue init
```

**What it does:**

1. Detects AI coding agents in your workspace (Cursor, Copilot, Claude Code, etc.)
2. Creates `.aligntrue/config.yaml` with detected agents enabled
3. Creates `.aligntrue/rules.md` with starter template (5 example rules)
4. Optionally runs `aligntrue sync` to generate agent files

**Interactive prompts:**

- **Agents detected** - Choose which agents to enable (auto-enables if ≤3 detected)
- **Project ID** - Identifier for your project (used in rule IDs)
- **Create files?** - Confirm before writing
- **Run sync now?** - Generate agent files immediately

**Examples:**

```bash
# Fresh project setup
aligntrue init

# Already have rules? Import them
# (Cursor .mdc files or AGENTS.md detected automatically)
aligntrue init
```

**Exit codes:**

- `0` - Success
- `1` - Already initialized (shows guidance for team join vs re-init)
- `2` - System error (permissions, disk space, etc.)

**See also:** [Quickstart Guide](/getting-started/quickstart) for step-by-step walkthrough.

---

### `aligntrue import`

Analyze and import rules from agent-specific formats with coverage analysis.

**Usage:**

```bash
aligntrue import <agent> [options]
```

**Arguments:**

- `agent` - Agent format to analyze (cursor, agents-md, copilot, claude-code, aider)

**Flags:**

| Flag            | Description                                   | Default |
| --------------- | --------------------------------------------- | ------- |
| `--coverage`    | Show import coverage report                   | `true`  |
| `--no-coverage` | Skip coverage report                          | `false` |
| `--write`       | Write imported rules to `.aligntrue/rules.md` | `false` |
| `--dry-run`     | Preview without writing files                 | `false` |

**What it does:**

1. Loads rules from agent-specific format (`.cursor/rules/*.mdc` or `AGENTS.md`)
2. Parses agent format to IR (Intermediate Representation)
3. Generates coverage report showing field-level mapping
4. Calculates coverage percentage and confidence level
5. Optionally writes rules to `.aligntrue/rules.md`

**Coverage Report:**

The coverage report shows:

- **Rules imported** - Number of rules found in agent format
- **Field mapping** - Which IR fields are mapped from agent format
- **Unmapped fields** - Fields that cannot be mapped (preserved in `vendor.*`)
- **Coverage percentage** - (mapped fields / total IR fields) × 100
- **Confidence level** - high (≥90%), medium (70-89%), low (<70%)
- **Vendor preservation** - Whether agent-specific metadata is preserved

**Examples:**

```bash
# Analyze Cursor rules
aligntrue import cursor

# Import from AGENTS.md
aligntrue import agents-md

# Import and write to IR file
aligntrue import cursor --write

# Preview import without writing
aligntrue import cursor --write --dry-run

# Skip coverage report
aligntrue import cursor --no-coverage
```

**Supported Agents:**

- **cursor** - `.cursor/rules/*.mdc` files with YAML frontmatter
- **agents-md** - `AGENTS.md` universal markdown format
- **copilot** - AGENTS.md format (alias)
- **claude-code** - AGENTS.md format (alias)
- **aider** - AGENTS.md format (alias)

See [Import Workflow Guide](/reference/import-workflow) for step-by-step migration instructions.

**Exit codes:**

- `0` - Success
- `1` - Error (agent not found, no rules, unsupported agent)

**See also:** [Sync Behavior](/concepts/sync-behavior) for two-way sync details.

---

### `aligntrue sync`

Sync rules from `.aligntrue/rules.md` to your AI coding agents.

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
| `--config <path>`       | Custom config file path                       | `.aligntrue/config.yaml` |

**What it does:**

1. Loads configuration from `.aligntrue/config.yaml`
2. Parses rules from `.aligntrue/rules.md`
3. Generates agent-specific files (`.cursor/*.mdc`, `AGENTS.md`, etc.)
4. Detects conflicts if files were manually edited
5. Updates lockfile (team mode only)

**Examples:**

```bash
# Standard sync
aligntrue sync

# Preview without writing
aligntrue sync --dry-run

# Non-interactive (for CI)
aligntrue sync --force

# Pull changes from Cursor back to rules.md (mock data)
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
[a] Accept agent (pull manual edits to rules.md - mock data)
[d] Show diff
[q] Quit
```

**Team mode behavior:**

When `mode: team` is enabled in config:

- Validates lockfile before sync (soft/strict mode)
- Regenerates lockfile after successful sync
- Detects drift and suggests resolution

**See also:** [Sync Behavior](/concepts/sync-behavior) for detailed contract.

---

### `aligntrue check`

Validate rules and lockfile without syncing. Great for CI/CD pipelines.

**Usage:**

```bash
aligntrue check [options]
```

**Flags:**

| Flag              | Description                                  | Default                  |
| ----------------- | -------------------------------------------- | ------------------------ |
| `--ci`            | CI mode (non-interactive, strict exit codes) | `false`                  |
| `--config <path>` | Custom config file path                      | `.aligntrue/config.yaml` |

**What it validates:**

1. **Schema validation** - `.aligntrue/rules.md` matches JSON Schema
2. **Lockfile validation** - `.aligntrue.lock.json` matches current rules (team mode only)

**Examples:**

```bash
# Local validation
aligntrue check

# CI validation (strict mode)
aligntrue check --ci
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

**See also:** [Troubleshooting Guide](/reference/troubleshooting#check-issues-ci) for common check failures.

---

### `aligntrue backup`

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

#### `aligntrue backup create`

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
  rules.md

Restore with: aligntrue backup restore --to 2025-10-29T14-30-00-000
```

#### `aligntrue backup list`

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
    Files: 2 (config.yaml, rules.md)
    Notes: Before experimental changes

  2025-10-29T12-15-45-123
    Created: Oct 29, 2025 at 12:15:45 PM
    Files: 3 (config.yaml, rules.md, privacy-consent.json)
    Notes: Auto-backup before sync

3 backups found
```

#### `aligntrue backup restore`

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
  rules.md
```

**Warning:** This overwrites your current `.aligntrue/` directory. Use `backup list` to verify timestamp before restoring.

#### `aligntrue backup cleanup`

Remove old backups, keeping only the most recent N backups.

**Usage:**

```bash
# Use keep_count from config (default: 10)
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

#### Auto-backup configuration

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
  keep_count: 10
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

**See also:** [Backup and Restore Guide](/reference/backup-restore) for detailed usage and troubleshooting.

---

## Development commands

Tools for working with markdown rules, managing adapters, and validating syntax.

### `aligntrue adapters`

Manage exporters (adapters) in your configuration. View, enable, and disable adapters for 43 supported AI coding agents.

**Usage:**

```bash
aligntrue adapters <subcommand>
```

**Subcommands:**

- `list` - Show all available adapters with install status
- `enable <adapter>` - Enable an adapter in config
- `enable --interactive` - Choose adapters with multiselect UI
- `disable <adapter>` - Disable an adapter in config

---

#### `aligntrue adapters list`

Show all 43 discovered adapters with their current install status.

**Usage:**

```bash
aligntrue adapters list
```

**Status indicators:**

- `✓` **Installed** - Enabled in your `.aligntrue/config.yaml`
- `-` **Available** - Discovered but not enabled
- `❌` **Invalid** - In config but not found (shows warning, non-blocking)

**Example output:**

```
Available Adapters (44 total):

✓ cursor                  Export AlignTrue rules to Cursor .mdc format
                          Outputs: .cursor/rules/*.mdc

✓ agents-md               Export AlignTrue rules to universal AGENTS.md format
                          Outputs: AGENTS.md

- claude-md               Export AlignTrue rules to Claude CLAUDE.md format
                          Outputs: CLAUDE.md

- vscode-mcp              Export AlignTrue rules to VS Code MCP configuration
                          Outputs: .vscode/mcp.json

- windsurf-mcp            Export AlignTrue rules to Windsurf MCP configuration
                          Outputs: .windsurf/mcp_config.json

❌ nonexistent-adapter     (Not found in available adapters)

Summary:
  ✓ Installed: 2
  - Available: 41
  ❌ Invalid: 1
```

**Exit codes:**

- `0` - Success
- `1` - Config not found

---

#### `aligntrue adapters enable`

Enable one or more adapters by adding them to your config.

**Single adapter:**

```bash
aligntrue adapters enable <adapter>
```

**Interactive mode:**

```bash
aligntrue adapters enable --interactive
# or
aligntrue adapters enable -i
```

**What it does:**

1. Validates adapter exists in discovered manifests
2. Checks if already enabled (shows friendly message, exits 0)
3. Adds to `config.exporters` array (sorted alphabetically)
4. Saves config atomically (temp + rename)
5. Shows success message and next steps

**Interactive mode features:**

- Visual multiselect UI powered by @clack/prompts
- Pre-selects currently enabled adapters
- Toggle any available adapter
- Shows adapter descriptions and output paths
- Cancel-safe (Ctrl+C exits cleanly)

**Examples:**

```bash
# Enable a single adapter
aligntrue adapters enable claude-md

# Enable multiple adapters interactively
aligntrue adapters enable --interactive

# Already enabled (idempotent)
aligntrue adapters enable cursor
# Output: ✓ Adapter already enabled: cursor
```

**Example output:**

```
✓ Enabled adapter: claude-md

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success (or already enabled)
- `1` - Adapter not found, config error, or invalid adapter

---

#### `aligntrue adapters disable`

Disable an adapter by removing it from your config.

**Usage:**

```bash
aligntrue adapters disable <adapter>
```

**Safety features:**

- Cannot disable last adapter (at least one must be configured)
- Validates adapter is currently enabled
- Shows clear error messages with actionable fixes

**Examples:**

```bash
# Disable an adapter
aligntrue adapters disable claude-md

# Cannot disable last adapter
aligntrue adapters disable cursor
# Error: Cannot disable last adapter
#   At least one exporter must be configured
#   Enable another adapter first: aligntrue adapters enable <adapter>

# Not enabled
aligntrue adapters disable nonexistent
# Error: Adapter not enabled: nonexistent
#   Run: aligntrue adapters list
```

**Example output:**

```
✓ Disabled adapter: claude-md
```

**Exit codes:**

- `0` - Success
- `1` - Adapter not enabled, last adapter, or config error

---

### `aligntrue md lint`

Check markdown syntax in `.aligntrue/rules.md`.

**Usage:**

```bash
aligntrue md lint [file]
```

**What it validates:**

- Fenced code blocks use `aligntrue` language tag
- One block per markdown section (no multiple blocks)
- Valid YAML inside fenced blocks
- Schema compliance for rules

**Examples:**

```bash
# Lint default rules file
aligntrue md lint

# Lint specific file
aligntrue md lint custom-rules.md
```

**Exit codes:**

- `0` - Valid markdown
- `1` - Syntax errors found
- `2` - File not found

---

### `aligntrue md format`

Format markdown rules file with consistent style.

**Usage:**

```bash
aligntrue md format [file]
```

**What it does:**

- Normalizes whitespace (tabs → spaces, trim trailing)
- Ensures consistent EOF newline
- Preserves guidance prose and structure

**Examples:**

```bash
# Format default rules file
aligntrue md format

# Format specific file
aligntrue md format custom-rules.md
```

---

### `aligntrue md compile`

Compile markdown to intermediate representation (IR) for validation.

**Usage:**

```bash
aligntrue md compile [file]
```

**What it does:**

- Extracts fenced `aligntrue` blocks
- Compiles to internal IR format
- Validates against schema
- Outputs JSON IR to stdout

**Examples:**

```bash
# Compile to IR
aligntrue md compile

# Compile and save to file
aligntrue md compile > rules.json
```

---

### `aligntrue md generate`

Generate markdown from YAML (round-trip workflow).

**Usage:**

```bash
aligntrue md generate <file> [--output <path>] [--preserve-style] [--canonical] [--header <text>]
```

**Flags:**

- `--output, -o` - Output file path (default: stdout)
- `--preserve-style` - Use `_markdown_meta` if present (default: true)
- `--canonical` - Force canonical formatting (ignore metadata)
- `--header <text>` - Custom header text

**What it does:**

- Reads YAML file (aligntrue.yaml or custom IR)
- Generates markdown with fenced `aligntrue` block
- Preserves original formatting if metadata available
- Supports custom headers and indent styles

**Examples:**

```bash
# Generate markdown (stdout)
aligntrue md generate aligntrue.yaml

# Generate and save to file
aligntrue md generate aligntrue.yaml --output rules.md

# Generate with custom header
aligntrue md generate aligntrue.yaml --header "## My Project Rules"

# Force canonical format (ignore metadata)
aligntrue md generate aligntrue.yaml --canonical
```

**Round-trip workflow:**

```bash
# Start with markdown
aligntrue md compile rules.md --output aligntrue.yaml

# Edit YAML as needed

# Generate back to markdown
aligntrue md generate aligntrue.yaml --output rules.md --preserve-style
```

**Output format:**

````markdown
# AlignTrue Rules

```aligntrue
id: my-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: warn
    applies_to: ["**/*.ts"]
```
````

````

---

## Overlay commands

Commands for customizing third-party packs without forking. Available in all modes.

### `aligntrue override add`

Create a new overlay to customize rules without forking.

**Usage:**

```bash
aligntrue override add [options]
```

**Options:**

| Flag                  | Description                       | Required |
| --------------------- | --------------------------------- | -------- |
| `--selector <string>` | Selector string (rule[id=...], property.path, array[0]) | Yes |
| `--set <key=value>`   | Set property (repeatable, supports dot notation) | No*      |
| `--remove <key>`      | Remove property (repeatable)      | No*      |
| `--config <path>`     | Custom config file path           | No       |

*At least one of `--set` or `--remove` is required

**What it does:**

1. Validates selector syntax
2. Parses set/remove operations
3. Adds overlay to `overlays.overrides[]` in config
4. Writes config atomically
5. Provides next steps (run `aligntrue sync`)

**Examples:**

```bash
# Change severity for specific rule
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# Set nested property with dot notation
aligntrue override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15

# Remove property
aligntrue override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix

# Multiple set operations
aligntrue override add \
  --selector 'rule[id=line-length]' \
  --set severity=warning \
  --set check.inputs.maxLength=120

# Combined set and remove
aligntrue override add \
  --selector 'rule[id=complexity]' \
  --set check.inputs.threshold=15 \
  --remove autofix
```

**Output:**

```
✓ Overlay added to config

Selector: rule[id=no-console-log]
  Set: severity=error

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid selector, missing operations)
- `2` - System error (file write failed)

**See also:** [Overlays Guide](/concepts/overlays) for complete overlay documentation.

---

### `aligntrue override status`

View dashboard of all overlays with health status.

**Usage:**

```bash
aligntrue override status [options]
```

**Options:**

| Flag            | Description                      | Default |
| --------------- | -------------------------------- | ------- |
| `--json`        | Output in JSON format            | `false` |
| `--config <path>` | Custom config file path        | (default) |

**What it shows:**

- Overlay count (total, healthy, stale)
- Selector for each overlay
- Operations (set, remove)
- Health status (healthy if selector matches, stale if no match)

**Examples:**

```bash
# Show all overlays
aligntrue override status

# JSON output for scripting
aligntrue override status --json
```

**Example output:**

```
Overlays (3 active, 1 stale)

✓ rule[id=no-console-log]
  Set: severity=error
  Healthy: yes

✓ rule[id=max-complexity]
  Set: check.inputs.threshold=15
  Healthy: yes

❌ rule[id=old-rule-name]
  Set: severity=off
  Healthy: stale (no match in IR)
```

**JSON output:**

```json
{
  "total": 3,
  "healthy": 2,
  "stale": 1,
  "overlays": [
    {
      "selector": "rule[id=no-console-log]",
      "health": "healthy",
      "operations": {
        "set": { "severity": "error" }
      }
    }
  ]
}
```

**Health indicators:**

- `✓` **Healthy** - Overlay selector matches rules in IR
- `❌` **Stale** - Selector matches no rules

**Exit codes:**

- `0` - Success
- `1` - Config not found

**See also:** [Drift Detection](/concepts/drift-detection) for automated staleness checks.

---

### `aligntrue override diff`

Show the effect of overlays on IR.

**Usage:**

```bash
aligntrue override diff [selector] [options]
```

**Arguments:**

- `selector` - Optional selector to filter (shows all if omitted)

**Options:**

| Flag           | Description                   | Default |
| -------------- | ----------------------------- | ------- |
| `--config <path>` | Custom config file path    | (default) |

**What it shows:**

1. **Original IR** - IR before overlays applied
2. **Modified IR** - IR after overlays applied
3. **Changes** - Summary of modifications

**Examples:**

```bash
# Show all overlay effects
aligntrue override diff

# Show effect of specific overlay
aligntrue override diff 'rule[id=no-console-log]'
```

**Example output:**

```
Overlay diff for: rule[id=no-console-log]

━━━ Original (upstream) ━━━
severity: warn

━━━ With overlay ━━━
severity: error

Changes: 1 property modified
```

**No overlay case:**

```
No overlays match selector: rule[id=nonexistent]
```

**Exit codes:**

- `0` - Success
- `1` - Selector invalid or no overlays found

**See also:** [Overlays Guide](/concepts/overlays) for overlay usage.

---

### `aligntrue override remove`

Remove an overlay.

**Usage:**

```bash
aligntrue override remove [selector] [options]
```

**Arguments:**

- `selector` - Optional selector string (if omitted, interactive mode)

**Options:**

| Flag            | Description                  | Default |
| --------------- | ---------------------------- | ------- |
| `--force`       | Skip confirmation            | `false` |
| `--config <path>` | Custom config file path    | (default) |

**What it does:**

1. If no selector: shows interactive list of overlays
2. Finds matching overlay by selector
3. Prompts for confirmation (unless `--force`)
4. Removes overlay from config
5. Writes config atomically

**Examples:**

```bash
# Interactive removal (select from list)
aligntrue override remove

# Remove by selector
aligntrue override remove 'rule[id=no-console-log]'

# Remove without confirmation
aligntrue override remove 'rule[id=no-console-log]' --force
```

**Interactive mode:**

```
? Select overlay to remove
  > rule[id=no-console-log] (Set: severity=error)
    rule[id=max-complexity] (Set: check.inputs.threshold=15)
    rule[id=old-rule] (Set: severity=off)

Remove overlay: rule[id=no-console-log]? (y/N): y

✓ Overlay removed

Next step:
  Run: aligntrue sync
```

**Exit codes:**

- `0` - Success
- `1` - No matching overlay found

**See also:** [Overlays Guide](/concepts/overlays)

---

## Team commands

Commands for managing team mode features (hidden until team mode enabled).

### `aligntrue drift`

Detect drift between lockfile and approved sources. Monitors upstream changes, vendored pack integrity, and policy compliance.

**Usage:**
```bash
aligntrue drift [options]
```

**Options:**
- `--gates` - Exit non-zero if drift detected (CI mode)
- `--json` - Output results in JSON format
- `--sarif` - Output results in SARIF format for CI tools
- `--config <path>` - Custom config file path

**Examples:**
```bash
# Check for drift
aligntrue drift

# CI mode (fail on drift)
aligntrue drift --gates

# JSON output
aligntrue drift --json
```

**Drift categories:**
- **upstream** - Rule content differs from allowed version
- **vendorized** - Vendored pack differs from source
- **severity_remap** - Policy changes

**Exit codes:** `0` (no drift), `2` (drift with --gates)

**See:** [Drift detection guide](/concepts/drift-detection)

---

### `aligntrue update`

Check for and apply updates from approved sources. Generates UPDATE_NOTES.md with change summary.

**Usage:**
```bash
aligntrue update <check|apply> [options]
```

**Subcommands:**
- `check` - Preview available updates
- `apply` - Apply updates and generate UPDATE_NOTES.md

**Options:**
- `--config <path>` - Custom config file path
- `--dry-run` - Preview without applying (apply only)

**Examples:**
```bash
# Check for updates
aligntrue update check

# Apply updates
aligntrue update apply

# Preview what would be applied
aligntrue update apply --dry-run
```

**Update workflow:**
1. Detects updates by comparing lockfile to allow list
2. Generates UPDATE_NOTES.md with change summary
3. Runs `aligntrue sync --force` automatically
4. Updates lockfile with new hashes

**Update summary includes:**
- Number of sources updated
- Affected rules per source
- Breaking changes (if any)
- Previous and current commit SHAs

**Exit codes:** `0` (success), `1` (validation error), `2` (system error)

**Requirements:** Team mode enabled

**See:** [Auto-updates guide](/reference/auto-updates)

---

### `aligntrue onboard`

Generate personalized developer onboarding checklist based on recent work, check results, and project state.

**Usage:**
```bash
aligntrue onboard [options]
```

**Options:**
- `--ci <path>` - Path to SARIF file with CI check results
- `--config <path>` - Custom config file path

**Examples:**
```bash
# Basic onboarding checklist
aln onboard

# Include CI check results
aln onboard --ci checks.sarif

# Use custom config
aln onboard --config custom-config.yaml
```

**Checklist includes:**
- Recent commit history and file changes
- Uncommitted changes warnings
- Test file patterns (suggest running tests)
- Source changes without tests (warning)
- Documentation updates
- Team drift (in team mode)
- Unresolved required plugs
- Failed checks (when --ci provided)

**Integrations:**
- **Drift detection** - Shows team drift in team mode
- **Check results** - Parses SARIF from CI runs
- **Plugs** - Detects unresolved required plugs automatically

**Output format:**
```
🚀 Developer Onboarding Checklist

Based on your recent work:
  Last commit: feat: Add feature
  By: Developer Name
  Files changed: 5

Actionable next steps:

1. ⚠️ Run tests (2 test files modified)
   → Run: pnpm test

2. ℹ️ Run validation checks
   → Run: aligntrue check
```

**Exit codes:** `0` (success)

**See:** [Onboarding guide](/contributing/team-onboarding)

---

### `aligntrue team enable`

Upgrade project to team mode with lockfile validation.

**Usage:**

```bash
aligntrue team enable
````

**What it does:**

1. Updates `.aligntrue/config.yaml` to set `mode: team`
2. Enables lockfile and bundle modules automatically
3. Shows next steps for lockfile generation

**Interactive prompts:**

- **Confirm team mode** - Explains lockfile and bundle features
- **Idempotent** - Safe to run multiple times

**Examples:**

```bash
# Enable team mode
aligntrue team enable

# Then generate lockfile
aligntrue sync  # Auto-generates .aligntrue.lock.json
```

**Exit codes:**

- `0` - Success (or already in team mode)
- `2` - System error (file write failed)

**What changes:**

Before (solo mode):

```yaml
mode: solo
modules:
  lockfile: false
  bundle: false
```

After (team mode):

```yaml
mode: team
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: soft # Warn on drift, don't block
```

**See also:** [Sync Behavior](/concepts/sync-behavior#lockfile-behavior-team-mode) for lockfile modes.

---

### `aligntrue scopes`

List configured scopes from config.

**Usage:**

```bash
aligntrue scopes
```

**What it shows:**

- Scope paths
- Include/exclude patterns
- Configured rulesets

**Examples:**

```bash
# List all scopes
aligntrue scopes
```

**Output:**

```
Configured scopes (2):

1. apps/web
   Include: ["**/*.ts", "**/*.tsx"]
   Exclude: ["**/*.test.ts"]
   Rulesets: ["nextjs-rules"]

2. packages/core
   Include: ["**/*.ts"]
   Exclude: []
   Rulesets: ["core-standards"]
```

**Exit codes:**

- `0` - Success
- `2` - Config not found

---

### `aligntrue pull`

Pull rules from any git repository ad-hoc (try before commit workflow).

**Usage:**

```bash
aligntrue pull <git-url> [options]
```

**What it does:**

1. Pulls rules from specified git repository
2. Caches repository in `.aligntrue/.cache/git/`
3. Displays results (rule count, profile info)
4. **Does NOT modify config** by default (use `--save` to persist)

**Key concept:** Pull lets you test rules from any repository without committing to them. This enables:

- **Try before commit** - Test rules before adding to config
- **Team sharing** - Share git URLs for quick rule discovery
- **Exploration** - Discover community and organization rules

**Options:**

- `--save` - Add git source to config permanently
- `--ref <branch|tag|commit>` - Specify git ref (default: `main`)
- `--sync` - Run sync immediately after pull (requires `--save`)
- `--dry-run` - Preview what would be pulled without pulling
- `--offline` - Use cache only, no network operations
- `--config, -c <path>` - Custom config file path

**Examples:**

```bash
# Pull and inspect rules
aligntrue pull https://github.com/yourorg/rules

# Pull specific version
aligntrue pull https://github.com/yourorg/rules --ref v1.2.0

# Pull and add to config
aligntrue pull https://github.com/yourorg/rules --save

# Pull, save, and sync in one step
aligntrue pull https://github.com/yourorg/rules --save --sync

# Preview without pulling
aligntrue pull https://github.com/yourorg/rules --dry-run

# Use cache only (no network)
aligntrue pull https://github.com/yourorg/rules --offline
```

**Output example:**

```
📦 Pull results:

  Repository: https://github.com/yourorg/rules
  Ref: main
  Rules: 12
  Profile: yourorg-typescript
  Location: .aligntrue/.cache/git (cached)

✓ Rules pulled (temporary - not saved to config)
```

**Privacy:**

First git pull triggers consent prompt:

```
Git clone requires network access. Grant consent? (y/n)
```

Consent is persistent (stored in `.aligntrue/privacy-consent.json`). Manage with:

```bash
aligntrue privacy audit          # View consents
aligntrue privacy revoke git     # Revoke git consent
```

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid URL, consent denied, etc.)
- `2` - System error (network failure, cache error, etc.)

**Common workflows:**

**Solo developer - Try before commit:**

```bash
# Step 1: Pull and inspect
aligntrue pull https://github.com/community/typescript-rules

# Step 2: Review rules
cat .aligntrue/.cache/git/<hash>/.aligntrue.yaml

# Step 3: If satisfied, pull with --save
aligntrue pull https://github.com/community/typescript-rules --save

# Step 4: Sync to agents
aligntrue sync
```

**Team - Quick onboarding:**

```bash
# Pull, save, and sync in one command
aligntrue pull https://github.com/yourorg/team-rules --save --sync
```

**CI/CD - Pre-warm cache:**

```bash
# Setup step (with network)
aligntrue pull https://github.com/yourorg/rules

# Build step (offline)
aligntrue pull https://github.com/yourorg/rules --offline
aligntrue sync --dry-run
```

**See also:**

- [Git Workflows Guide](/concepts/git-workflows) - Complete pull command workflows
- [Git Sources Guide](/reference/git-sources) - Config-based permanent git sources
- [Privacy Guide](/reference/privacy) - Network consent management

---

### `aligntrue link`

Vendor rule packs from git repositories using git submodules or subtrees.

**Usage:**

```bash
aligntrue link <git-url> [--path <vendor-path>]
```

**What it does:**

1. Detects existing submodule/subtree vendoring at specified path
2. Validates pack integrity (`.aligntrue.yaml` required at repo root)
3. Updates config with vendor metadata (path and type)
4. Provides workflow guidance for updates and collaboration

**Does NOT execute git operations** - You must vendor manually first using git submodule or subtree.

**Key concept:** Link registers vendored packs so AlignTrue can track their provenance for drift detection. Vendoring provides:

- **Offline access** - Rules available without network
- **Version control** - Vendored code tracked in your repo
- **Security auditing** - Review all vendored code before use
- **Team collaboration** - Clear ownership and update workflows

**Options:**

- `--path <vendor-path>` - Custom vendor location (default: `vendor/<repo-name>`)
- `--config, -c <path>` - Custom config file path

**Examples:**

```bash
# Submodule workflow
git submodule add https://github.com/org/rules vendor/org-rules
aligntrue link https://github.com/org/rules --path vendor/org-rules

# Subtree workflow
git subtree add --prefix vendor/org-rules https://github.com/org/rules main --squash
aligntrue link https://github.com/org/rules --path vendor/org-rules

# Default vendor path
git submodule add https://github.com/org/rules vendor/rules
aligntrue link https://github.com/org/rules
```

**Vendor type detection:**

AlignTrue automatically detects:

- **Submodule** - `.git` file with `gitdir:` reference
- **Subtree** - `.git` directory (full git repo)

**Team mode integration:**

In team mode, link warns if source is not in allow list:

```
⚠️  Not in allow list

This source is not in your team's allow list.
To approve this source:
  aligntrue team approve "https://github.com/org/rules"

This is non-blocking but recommended for team workflows.
```

Approve before or after linking - both work.

**Output example:**

```
✅ Successfully linked https://github.com/org/rules

Vendor path: vendor/org-rules
Vendor type: submodule
Profile: org/typescript-rules

Next steps:
1. Commit vendor changes: git add vendor/org-rules .aligntrue/config.yaml
2. Run sync: aligntrue sync
3. Update lockfile (if team mode): git add .aligntrue.lock.json
```

**Update workflows:**

**Submodule:**

```bash
cd vendor/org-rules
git pull origin main
cd ../..
git add vendor/org-rules
git commit -m "chore: Update vendored rules"
```

**Subtree:**

```bash
git subtree pull --prefix vendor/org-rules https://github.com/org/rules main --squash
```

**Common use cases:**

**When to vendor vs pull:**

Use `aligntrue link` (vendoring) for:

- Production dependencies (offline access required)
- Security-critical rules (audit before use)
- Stable versions (infrequent updates)

Use `aligntrue pull` (ad-hoc) for:

- Testing rules before committing
- Exploring community rules
- Rapid iteration

**Submodule vs Subtree:**

| Aspect     | Submodule                         | Subtree               |
| ---------- | --------------------------------- | --------------------- |
| Complexity | Requires `git submodule` commands | Just `git pull`       |
| Space      | More efficient (reference only)   | Full copy in repo     |
| Team setup | `git submodule init && update`    | No extra steps        |
| History    | Separate                          | Merged with main repo |
| Updates    | `git submodule update`            | `git subtree pull`    |

**Recommendation:** Subtrees for simplicity, submodules for space efficiency.

**Exit codes:**

- `0` - Success
- `1` - Validation error (invalid URL, duplicate vendor, pack validation failed)
- `2` - System error (git operations, file system errors)

**Troubleshooting:**

**Error: "Vendor already exists"**

Remove existing vendor first:

```bash
# For submodule
git rm -rf vendor/org-rules
rm -rf .git/modules/vendor/org-rules
git commit -m "chore: Remove old vendor"

# For subtree
git rm -rf vendor/org-rules
git commit -m "chore: Remove old vendor"

# Then re-link
git submodule add https://github.com/org/rules vendor/org-rules
aligntrue link https://github.com/org/rules --path vendor/org-rules
```

**Error: "Pack validation failed"**

Ensure vendored repo has valid `.aligntrue.yaml` at root:

```bash
# Check pack file exists
ls vendor/org-rules/.aligntrue.yaml

# Validate pack manually
cat vendor/org-rules/.aligntrue.yaml
```

Required fields: `id`, `version`, `spec_version`, `profile.id`

**See also:**

- [Git Workflows Guide - Vendoring](/concepts/git-workflows#vendoring-workflows) - Complete vendoring workflows
- [Team Mode Guide](/concepts/team-mode) - Team approval workflows
- [Privacy Guide](/reference/privacy) - Network consent management

---

## Settings commands

Manage AlignTrue settings and preferences.

### `aligntrue team enable|approve|list-allowed|remove`

Manage team mode and approved rule sources. See [Team Mode Guide](/concepts/team-mode) for complete workflows.

**Usage:**

```bash
aligntrue team enable                           # Enable team mode
aligntrue team approve <source> [<source2>...]  # Approve source(s)
aligntrue team list-allowed                     # List approved sources
aligntrue team remove <source> [<source2>...]   # Remove source(s)
```

**Key concepts:**

- **Team mode**: Enables lockfile, bundle, and allow list validation
- **Allow list**: `.aligntrue/allow.yaml` with approved rule sources
- **Source formats**: `id@profile@version` or `sha256:...`

**Example workflow:**

```bash
# Enable team mode
aligntrue team enable

# Approve sources
aligntrue team approve base-global@aligntrue/catalog@v1.0.0

# List approved
aligntrue team list-allowed

# Sync (validates against allow list)
aligntrue sync

# Bypass validation (emergency only)
aligntrue sync --force
```

---

### `aligntrue telemetry on|off|status`

Control anonymous usage telemetry (opt-in only, disabled by default).

**Usage:**

```bash
aligntrue telemetry <command>
```

**Commands:**

- `on` - Enable telemetry collection
- `off` - Disable telemetry collection
- `status` - Show current telemetry status

**What we collect (when enabled):**

- Command names (`init`, `sync`, `check`, etc.)
- Export targets (`cursor`, `agents-md`, etc.)
- Rule hashes used (SHA-256, no content)
- Anonymous UUID (generated once)

**What we NEVER collect:**

- File paths or repo names
- Code or rule content
- Personal information
- Anything identifying you or your project

**Examples:**

```bash
# Check status
aligntrue telemetry status

# Enable collection
aligntrue telemetry on

# Disable collection
aligntrue telemetry off
```

**Output:**

```
Telemetry: Enabled
UUID: a3b2c1d4-e5f6-1234-5678-9abcdef01234

We collect:
  • Command names
  • Export targets
  • Rule hashes (no content)

We NEVER collect:
  • File paths or code
  • Personal information
```

**Storage:**

- State: `.aligntrue/telemetry.json`
- Events: `.aligntrue/telemetry-events.json` (last 1000 events)

**See also:** [Privacy Policy](/reference/privacy) for complete details.

### `aligntrue privacy audit|revoke`

Manage privacy consents for network operations.

**Usage:**

```bash
aligntrue privacy audit                    # List all consents
aligntrue privacy revoke <operation>       # Revoke specific consent
aligntrue privacy revoke --all             # Revoke all consents
```

**Commands:**

- `audit` - List all granted consents with timestamps
- `revoke catalog` - Revoke consent for catalog fetches
- `revoke git` - Revoke consent for git clones
- `revoke --all` - Revoke all consents (prompts for confirmation)

**How consent works:**

1. **First time** a network operation is needed (catalog or git source), you'll see a clear error
2. The error message explains what consent is needed and how to grant it
3. **After granting**, AlignTrue remembers and won't prompt again
4. **Revoke anytime** using `aligntrue privacy revoke`

**Examples:**

```bash
# List all consents
aligntrue privacy audit

# Revoke catalog consent
aligntrue privacy revoke catalog

# Revoke all consents with confirmation
aligntrue privacy revoke --all
```

**Audit output:**

```
Privacy Consents

  ✓ catalog    Granted Oct 29, 2025 at 10:30 AM
  ✓ git        Granted Oct 29, 2025 at 11:45 AM

Use 'aligntrue privacy revoke <operation>' to revoke
```

**When no consents:**

```
No privacy consents granted yet

Network operations will prompt for consent when needed.
Run "aligntrue privacy audit" after granting consent to see details.
```

**Storage:**

- Consents: `.aligntrue/privacy-consent.json` (git-ignored)
- Per-machine, not committed to git
- Simple JSON format you can edit manually if needed

**Offline mode:**

```bash
# Skip all network operations, use cache only
aligntrue sync --offline
```

Offline mode bypasses consent checks entirely (no network = no consent needed).

**See also:**

- [Privacy Policy](/reference/privacy) - Complete privacy details
- [Sync command](#aligntrue-sync) - Offline flag documentation

---

## Getting help

```bash
# Show all commands
aligntrue --help

# Show command-specific help
aligntrue sync --help
```

**Exit codes summary:**

- `0` - Success
- `1` - Validation error (user-fixable)
- `2` - System error (permissions, disk space, etc.)

---

## Error codes

AlignTrue uses standardized error codes for consistent debugging and support. All errors include:

- **Clear title and message** - What went wrong
- **Actionable hints** - Next steps to fix
- **Error codes** - Reference for support

### System errors (exit code 2)

These errors indicate missing files, permissions, or system issues:

- `ERR_CONFIG_NOT_FOUND` - Configuration file missing

  ```
  ✗ Config file not found

  Could not locate: .aligntrue/config.yaml

  Hint: Run 'aligntrue init' to create initial configuration

  Error code: ERR_CONFIG_NOT_FOUND
  ```

- `ERR_RULES_NOT_FOUND` - Rules file missing

  ```
  ✗ Rules file not found

  Could not locate: .aligntrue/rules.md

  Hint: Run 'aligntrue init' to create initial rules

  Error code: ERR_RULES_NOT_FOUND
  ```

- `ERR_FILE_WRITE_FAILED` - File I/O error

  ```
  ✗ File write failed

  Could not write to: .aligntrue/config.yaml

  Details:
    - Permission denied (EACCES)

  Hint: Check file permissions and disk space

  Error code: ERR_FILE_WRITE_FAILED
  ```

### Validation errors (exit code 1)

These errors indicate invalid configuration, rules, or data:

- `ERR_VALIDATION_FAILED` - Schema or rule validation failed

  ```
  ✗ Validation failed

  Errors in .aligntrue/rules.md

  Details:
    - spec_version: Missing required field
    - rules: Missing required field

  Hint: Fix the errors above and try again

  Error code: ERR_VALIDATION_FAILED
  ```

- `ERR_SYNC_FAILED` - Sync operation failed

  ```
  ✗ Sync failed

  Failed to load exporters: Handler not found

  Hint: Run 'aligntrue sync --help' for more options

  Error code: ERR_SYNC_FAILED
  ```

- `ERR_LOCKFILE_VALIDATION_FAILED` - Lockfile drift detected

  ```
  ✗ Lockfile validation failed

  Lockfile contains errors or drift detected

  Details:
    - Rule 'test.rule' modified since lock

  Hint: Run 'aligntrue sync' to regenerate lockfile

  Error code: ERR_LOCKFILE_VALIDATION_FAILED
  ```

### Specific errors

- `ERR_ADAPTER_NOT_FOUND` - Adapter not available

  ```
  ✗ Adapter not found

  Adapter 'unknown' is not available

  Hint: Run 'aligntrue adapters list' to see available adapters

  Error code: ERR_ADAPTER_NOT_FOUND
  ```

- `ERR_MISSING_ARGUMENT` - Required CLI argument missing

  ```
  ✗ Missing required argument

  Argument 'adapter' is required

  Usage: aligntrue adapters disable <adapter>

  Error code: ERR_MISSING_ARGUMENT
  ```

- `ERR_OPERATION_FAILED` - Generic operation failure

  ```
  ✗ [Operation] failed

  [Detailed error message]

  Error code: ERR_OPERATION_FAILED
  ```

### Getting help

If you encounter an error:

1. **Read the hint** - Most errors include next steps
2. **Check exit codes** - 2 = system issue, 1 = validation issue
3. **Use error codes** - Reference for support or documentation
4. **Check troubleshooting** - [Common issues](/reference/troubleshooting)

---

## See also

- [Quickstart Guide](/getting-started/quickstart) - Get started in <60 seconds
- [Backup and Restore Guide](/reference/backup-restore) - Protect your configuration
- [Git Sources Guide](/reference/git-sources) - Pull rules from repositories
- [Import Workflow](/reference/import-workflow) - Migrate from existing agent rules
- [Troubleshooting](/reference/troubleshooting) - Common issues and fixes
- [Sync Behavior](/concepts/sync-behavior) - Two-way sync contract
- [Extending AlignTrue](/contributing/adding-exporters) - Add new exporters
