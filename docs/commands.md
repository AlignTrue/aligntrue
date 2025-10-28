# Command Reference

Complete reference for all AlignTrue CLI commands.

## Basic Commands

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

**See also:** [Quickstart Guide](quickstart.md) for step-by-step walkthrough.

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

| Flag | Description | Default |
|------|-------------|---------|
| `--coverage` | Show import coverage report | `true` |
| `--no-coverage` | Skip coverage report | `false` |
| `--write` | Write imported rules to `.aligntrue/rules.md` | `false` |
| `--dry-run` | Preview without writing files | `false` |

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

**Exit codes:**

- `0` - Success
- `1` - Error (agent not found, no rules, unsupported agent)

**See also:** [Sync Behavior](sync-behavior.md) for two-way sync details.

---

### `aligntrue sync`

Sync rules from `.aligntrue/rules.md` to your AI coding agents.

**Usage:**

```bash
aligntrue sync [options]
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--dry-run` | Preview changes without writing files | `false` |
| `--force` | Skip interactive prompts (for CI) | `false` |
| `--accept-agent <name>` | Pull changes from agent back to IR (mock data in Phase 1) | - |
| `--config <path>` | Custom config file path | `.aligntrue/config.yaml` |

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

**See also:** [Sync Behavior](sync-behavior.md) for detailed contract.

---

### `aligntrue check`

Validate rules and lockfile without syncing. Great for CI/CD pipelines.

**Usage:**

```bash
aligntrue check [options]
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--ci` | CI mode (non-interactive, strict exit codes) | `false` |
| `--config <path>` | Custom config file path | `.aligntrue/config.yaml` |

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

**See also:** [Troubleshooting Guide](troubleshooting.md#check-issues-ci) for common check failures.

---

## Development Commands

Tools for working with markdown rules and validating syntax.

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

## Team Commands

Commands for managing team mode features (hidden until team mode enabled).

### `aligntrue team enable`

Upgrade project to team mode with lockfile validation.

**Usage:**

```bash
aligntrue team enable
```

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
  mode: soft  # Warn on drift, don't block
```

**See also:** [Sync Behavior](sync-behavior.md#lockfile-behavior-team-mode) for lockfile modes.

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

## Settings Commands

Manage AlignTrue settings and preferences.

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

**See also:** [Privacy Policy](../PRIVACY.md) for complete details.

---

## Getting Help

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

## See Also

- [Quickstart Guide](quickstart.md) - Get started in <60 seconds
- [Troubleshooting](troubleshooting.md) - Common issues and fixes
- [Sync Behavior](sync-behavior.md) - Two-way sync contract
- [Extending AlignTrue](extending-aligntrue.md) - Add new exporters

