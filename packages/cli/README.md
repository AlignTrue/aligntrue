# @aligntrue/cli

Command-line interface for AlignTrue - the AI-native rules and alignment platform.

**YAML Library**: This package uses `yaml` for config generation and CLI operations (user-facing formatting). See [.internal_docs/yaml-libraries.md](../../.internal_docs/yaml-libraries.md) for rationale.

## Installation

```bash
pnpm install -g @aligntrue/cli
```

### Install from GitHub (latest changes)

Use this path when you want to test unreleased commits from `main`. The CLI relies on other AlignTrue workspace packages, so a workspace-wide build is required before running the binary.

```bash
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue
pnpm install          # installs all workspace deps
pnpm build            # builds every package the CLI imports
```

**Run the CLI using absolute path:**

```bash
./packages/cli/dist/index.js --version
./packages/cli/dist/index.js init --yes
```

**Why not `pnpm link --global`?**

`pnpm link --global` doesn't work with `workspace:*` dependencies. Node.js ESM loader cannot resolve subpath exports through symlinks when dependencies use the workspace protocol. You'll get `ERR_PACKAGE_PATH_NOT_EXPORTED` errors.

**For distribution testing:**

Use the distribution simulation script that rewrites `workspace:*` to concrete versions:

```bash
cd packages/cli
bash tests/scripts/test-distribution.sh
```

For iterative development, rerun `pnpm build` after dependency changes or `pnpm --filter @aligntrue/cli build` after CLI-only edits.

## Quick reference

```
AlignTrue CLI - AI-native rules and alignment platform

Usage: aligntrue <command> [options]

Basic Commands:
  init           Initialize AlignTrue in current directory
  sync           Sync rules to agents
  import         Import rules from agent configs
  check          Validate rules and configuration

Development Commands:
  exporters       Manage exporters (list, enable, disable)
  md             Markdown validation and formatting

Team Commands:
  team           Team mode management
  scopes         List configured scopes

Run aligntrue <command> --help for command-specific options
```

**Help is fast:** ~95ms response time for `--help`

**Flag grouping:** Each command organizes flags into Basic/Advanced sections for easier discovery

**Error messages:** All errors follow what/why/how format with actionable fixes

## Command development

AlignTrue CLI uses shared command utilities for consistent argument parsing and help display across all commands. When developing new commands or modifying existing ones:

- **Use command utilities** from `src/utils/command-utilities.ts` for parseArgs and showHelp
- **Follow established patterns** - see migrated commands (sync, check, import, config, privacy)
- **Optional test utilities** available in `tests/utils/command-test-helpers.ts`
- **Migration guide** available in [COMMAND-FRAMEWORK.md](./COMMAND-FRAMEWORK.md)

This ensures consistent behavior, reduces duplication, and makes commands easier to test and maintain.

## Commands

### `aligntrue init`

Initialize AlignTrue in your project with smart context detection.

**Features:**

- Auto-detects all 28 AI coding agents (Cursor, VS Code, Copilot, etc.)
- Enables detected agents automatically (≤3 agents) or prompts for selection (>3 agents)
- Creates comprehensive starter template with 5 example rules
- Handles team join scenarios with helpful guidance
- Optional auto-sync after initialization

**Usage:**

```bash
cd your-project
aligntrue init
```

**What it creates:**

- `.aligntrue/config.yaml` - Configuration with solo mode defaults
- `.aligntrue/rules` - Internal IR (auto-generated)

**Scenarios handled:**

- **Fresh start** - No rules exist, creates comprehensive template
- **Import existing** - Detects `.cursor/rules/` or `AGENTS.md`, offers import (Step 17)
- **Team join** - `.aligntrue/` exists, provides helpful next steps

**Example output:**

```
┌  AlignTrue Init
│
◇  Agent detection complete
│  ✓ Detected: Cursor, VS Code
│
◇  Will enable: Cursor, VS Code
│
◇  Project ID (for rules identifier):
│  my-project
│
◇  Will create:
│    - .aligntrue/config.yaml
│    - .aligntrue/rules
│
◇  Continue?
│  Yes
│
◇  Files created
│  ✓ Created .aligntrue/config.yaml
│  ✓ Created .aligntrue/rules
│
◇  Run sync now?
│  Yes
│
└  Next steps:
     1. Edit rules: AGENTS.md or .aligntrue/rules
     2. Run sync: aligntrue sync
```

### `aligntrue import`

Analyze and import rules from agent-specific formats with coverage analysis.

**Features:**

- Import from Cursor `.mdc` files or `AGENTS.md` universal format
- Field-level coverage analysis showing IR mapping
- Confidence calculation (high/medium/low) based on coverage percentage
- Vendor metadata preservation for round-trip fidelity
- Optional write to IR file with `--write` flag

**Usage:**

```bash
aligntrue import <agent> [options]
```

**Arguments:**

- `agent` - Agent format to analyze (cursor, agents, copilot, claude, aider)

**Options:**

- `--coverage` - Show import coverage report (default: true)
- `--no-coverage` - Skip coverage report
- `--write` - Write imported rules to .aligntrue/rules
- `--dry-run` - Preview without writing files
- `--help, -h` - Show help message

**Examples:**

Analyze Cursor rules with coverage:

```bash
aligntrue import cursor
```

Import from AGENTS.md:

```bash
aligntrue import agents
```

Import and write to IR file:

```bash
aligntrue import cursor --write
```

Preview import without writing:

```bash
aligntrue import cursor --write --dry-run
```

**Coverage Report Example:**

```
Import Coverage Report: cursor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Imported: 5 rules from .cursor/rules/*.mdc

Field Mapping:
✓ id              ← Rule header (## Rule: <id>)
✓ severity        ← **Severity:** metadata
✓ applies_to      ← **Applies to:** patterns
✓ guidance        ← Markdown prose
✓ vendor          ← YAML frontmatter → vendor.cursor

⚠ Unmapped Fields (preserved in vendor.*):
  • check          → vendor.cursor.check (not in .mdc format)
  • tags           → vendor.cursor.tags (not in .mdc format)

Coverage: 71% (5/7 IR fields mapped)
Confidence: Medium (70-89% coverage)

✓ Vendor metadata preserved for round-trip fidelity
```

**Supported Agents:**

- **cursor** - `.cursor/rules/*.mdc` files with YAML frontmatter
- **agents** - `AGENTS.md` universal markdown format
- **copilot** - AGENTS.md format (alias)
- **claude** - AGENTS.md format (alias)
- **aider** - AGENTS.md format (alias)

**Coverage Calculation:**

- **High confidence** (≥90%): Most IR fields mapped from agent format
- **Medium confidence** (70-89%): Core fields mapped, some fields unmapped
- **Low confidence** (<70%): Significant field gaps, review carefully

**Troubleshooting:**

**Agent not found:**

```
✗ Agent format not found: .cursor/rules/
Expected: .cursor/rules/ directory with .mdc files
```

**Unsupported agent:**

```
✗ Import not supported for agent: xyz
Supported agents: cursor, agents, copilot, claude, aider
```

**No rules found:**

```
⚠ No rules found in agent format
Check that .mdc files contain valid rules with ## Rule: headers
```

### `aligntrue sync`

Sync your rules to configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).

**Features:**

- Unidirectional sync: rules → IR → agents
- Preview changes with `--dry-run` before writing
- Non-interactive mode for CI with `--force`
- Lockfile validation in team mode (soft/strict enforcement)
- Comprehensive error messages with actionable fixes

**Usage:**

```bash
aligntrue sync [options]
```

**Options:**

- `--dry-run` - Preview changes without writing files
- `--config <path>` - Custom config file path (default: .aligntrue/config.yaml)
- `--force` - Non-interactive mode (skip prompts)

**Examples:**

Sync rules to all agents:

```bash
aligntrue sync
```

Preview changes:

```bash
aligntrue sync --dry-run
```

Non-interactive for CI:

```bash
aligntrue sync --force
```

**What it does:**

1. Loads `.aligntrue/config.yaml` configuration
2. Validates source file exists (default: `.aligntrue/rules`)
3. Discovers and loads exporters from registry
4. Resolves hierarchical scopes (if configured)
5. Validates lockfile (team mode only)
6. Syncs IR to agent config files
7. Shows files written, warnings, conflicts

### Sync Behavior

AlignTrue uses unidirectional sync from `.aligntrue/rules/` to agent files.

**Workflow:**

1. Edit files in `.aligntrue/rules/` (the single source of truth)
2. Run `aligntrue sync`
3. Changes flow to all configured agent exports (Cursor, AGENTS.md, etc.)

All agent files are read-only exports. If you manually edit an agent file, it will be backed up and overwritten on the next sync.

**Output example:**

```
┌  AlignTrue Sync
│
◇  Configuration loaded
│
◇  Loaded 2 exporters
│  ✓ Active: cursor, agents
│
◇  Sync complete
│  ✓ Wrote 2 files
│    .cursor/rules/testing.mdc
│    AGENTS.md
│
└  ✓ Sync complete
```

**Troubleshooting:**

**Config not found:**

```
✗ AlignTrue not initialized
Run: aligntrue init
```

**Source file not found:**

```
✗ Source file not found: .aligntrue/rules
Check your config.yaml sources section
```

**Exporter not found:**

```
⚠ Exporter not found: my-exporter
Check exporters list in config.yaml
```

**Lockfile drift (team mode):**

```
✗ Lockfile validation failed in strict mode
Options:
  1. Review changes and update lockfile: aligntrue lock
  2. Set lockfile.mode: soft in config for warnings only
```

### `aligntrue team enable`

Upgrade your project to team mode for lockfile-based collaboration.

**Features:**

- Enables lockfile generation for reproducibility
- Enables bundle generation for multi-source merging
- Drift detection with soft/strict validation modes
- Git-based collaboration workflows

**Usage:**

```bash
aligntrue team enable
```

**What it does:**

1. Updates `.aligntrue/config.yaml` to set `mode: team`
2. Enables `modules.lockfile: true` and `modules.bundle: true`
3. Shows next steps for lockfile generation
4. Team members can now clone and get identical outputs

**Example output:**

```
┌  Team Mode Enable
│
◇  Changes to .aligntrue/config.yaml:
│    - mode: solo → team
│    - modules.lockfile: false → true
│    - modules.bundle: false → true
│
◇  Enable team mode?
│  Yes
│
└  ✓ Team mode enabled

Next steps:
  1. Run: aligntrue sync
  2. Lockfile will be generated automatically
  3. Commit both config.yaml and .aligntrue/lock.json

Team members can now:
  - Clone the repo and run aligntrue sync
  - Get identical rule outputs (deterministic)
  - Detect drift with lockfile validation
```

**Already in team mode:**

```
✓ Already in team mode

Team mode features active:
  - Lockfile: enabled
  - Bundle: enabled
```

### `aligntrue scopes`

List configured scopes for monorepo path-based rule application.

**Features:**

- Shows all configured scopes from config.yaml
- Displays include/exclude patterns
- Shows ruleset overrides per scope
- Fast read-only operation

**Usage:**

```bash
aligntrue scopes
```

**Example output:**

```
Scopes configured in .aligntrue/config.yaml:

  packages/frontend
    Include: *.ts, *.tsx
    Exclude: **/*.test.ts

  packages/backend
    Include: *.ts
    Exclude: **/*.spec.ts

Total: 2 scopes
```

**No scopes configured:**

```
No scopes configured (applies rules to entire workspace)

To add scopes, edit .aligntrue/config.yaml:

scopes:
  - path: packages/frontend
    include:
      - "*.ts"
      - "*.tsx"
    exclude:
      - "**/*.test.ts"

See: docs/guides/scopes.md (when available)
```

### `aligntrue exporters`

Manage exporters (exporters) in your configuration. View available exporters, enable/disable them, and discover all 43 supported AI coding agents.

**Features:**

- List all 43 available exporters with descriptions
- Show install status (✓ installed, - available, ❌ invalid)
- Enable/disable exporters interactively or by name
- Prevents disabling the last exporter

#### `aligntrue exporters list`

Show all discovered exporters with their current status:

```bash
aligntrue exporters list
```

**Example output:**

```
Available Exporters (44 total):

✓ cursor                  Export AlignTrue rules to Cursor .mdc format
                          Outputs: .cursor/rules/*.mdc

✓ agents               Export AlignTrue rules to universal AGENTS.md format
                          Outputs: AGENTS.md

- claude               Export AlignTrue rules to Claude CLAUDE.md format
                          Outputs: CLAUDE.md

- vscode-mcp              Export AlignTrue rules to VS Code MCP configuration
                          Outputs: .vscode/mcp.json

❌ invalid-exporter         (Not found in available exporters)

Summary:
  ✓ Installed: 2
  - Available: 41
  ❌ Invalid: 1
```

**Status indicators:**

- `✓` - Installed (enabled in your config)
- `-` - Available (discovered but not enabled)
- `❌` - Invalid (in config but not found)

#### `aligntrue exporters enable <exporter>`

Enable an exporter by adding it to your config:

```bash
aligntrue exporters enable claude
```

**Example output:**

```
✓ Enabled exporter: claude

Next step:
  Run: aligntrue sync
```

**Interactive mode:**

Choose multiple exporters with a visual multiselect interface:

```bash
aligntrue exporters enable --interactive
# or
aligntrue exporters enable -i
```

The interactive prompt pre-selects currently enabled exporters and lets you toggle any available exporters.

#### `aligntrue exporters disable <exporter>`

Disable an exporter by removing it from your config:

```bash
aligntrue exporters disable claude
```

**Safety:**

- Cannot disable the last exporter (at least one must be configured)
- Shows clear error if exporter isn't currently enabled

**Example output:**

```
✓ Disabled exporter: claude
```

### Telemetry commands

AlignTrue includes optional, anonymous telemetry to help improve the product.

#### `aligntrue telemetry on`

Enable anonymous telemetry collection:

```bash
aligntrue telemetry on
```

**What we collect:**

- Command names (init, sync, etc.)
- Export targets used (cursor, agents, etc.)
- Rule content hashes (SHA-256, no actual content)

**What we never collect:**

- File paths or repository names
- Rule content or code
- Personally identifiable information (PII)

**Storage:** Local only (`.aligntrue/telemetry-events.json`), with optional sending after explicit consent (Privacy consent).

See [docs/PRIVACY.md](../../docs/PRIVACY.md) for complete details.

#### `aligntrue telemetry off`

Disable telemetry collection:

```bash
aligntrue telemetry off
```

Stops recording new events. Existing events remain in `.aligntrue/telemetry-events.json` until you delete the file.

#### `aligntrue telemetry status`

Check current telemetry status:

```bash
aligntrue telemetry status
```

**Output when enabled:**

```
Telemetry: enabled

Collecting anonymous usage data.
To disable: aligntrue telemetry off
```

**Output when disabled:**

```
Telemetry: disabled

No usage data is being collected.
To enable: aligntrue telemetry on
```

### `aligntrue check`

Validate rules and configuration for CI/CD pipelines and pre-commit hooks.

#### `aligntrue check --ci`

Non-interactive validation with clear exit codes:

```bash
aligntrue check --ci
```

**What it validates:**

- IR schema (loads and validates `.aligntrue/rules.md` against JSON Schema)
- Lockfile drift (team mode only, validates `.aligntrue/lock.json` matches current rules)

**Exit codes:**

- `0` - Validation passed
- `1` - Validation failed (schema or lockfile errors)
- `2` - System error (missing files, config issues)

**Options:**

- `--ci` - CI mode (required)
- `--config <path>` - Custom config path (default: `.aligntrue/config.yaml`)

**Example output (success):**

```
✓ Validation passed

  Schema: .aligntrue/rules.md is valid
  Lockfile: .aligntrue/lock.json matches current rules
```

**Example output (failure):**

```
✗ Schema validation failed

  Errors in .aligntrue/rules.md:
    - spec_version: Missing required field
    - rules[0].id: Missing required field

  Fix the errors above and run 'aligntrue check --ci' again.
```

### Other commands

- `aligntrue md` - Markdown validation and formatting (Step 4 ✓)
- `aligntrue migrate` - Migration status (Step 24 ✓)

## Quick start

```bash
cd your-project
aligntrue init
# Edit .aligntrue/rules.md
aligntrue sync
```

## CI integration

AlignTrue integrates seamlessly with CI/CD pipelines and pre-commit hooks using the `aligntrue check --ci` command.

### Pre-commit Hooks

Validate rules before committing to prevent broken configurations from entering version control.

#### Manual installation

Create a pre-commit hook:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# AlignTrue validation

echo "Running AlignTrue validation..."
pnpm aligntrue check --ci

if [ $? -ne 0 ]; then
  echo "❌ AlignTrue validation failed. Fix errors and try again."
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

#### With Husky

If you're using [Husky](https://typicode.github.io/husky/):

```bash
npx husky add .husky/pre-commit "pnpm aligntrue check --ci"
```

### GitHub Actions

Validate rules on every pull request and push to main branches:

```yaml
# .github/workflows/aligntrue.yml
name: AlignTrue Validation

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install

      - name: Validate AlignTrue rules
        run: pnpm aligntrue check --ci
```

### Other CI systems

The `aligntrue check --ci` command works in any CI environment. Just ensure AlignTrue is installed and run the command:

- **GitLab CI**: Add to `.gitlab-ci.yml`

  ```yaml
  aligntrue:
    script:
      - pnpm install
      - pnpm aligntrue check --ci
  ```

- **CircleCI**: Add to `.circleci/config.yml`

  ```yaml
  - run:
      name: Validate AlignTrue
      command: pnpm aligntrue check --ci
  ```

- **Jenkins**: Add to `Jenkinsfile`
  ```groovy
  sh 'pnpm aligntrue check --ci'
  ```

### Exit codes

Understanding exit codes helps with CI integration:

- `0` - Validation passed (continue pipeline)
- `1` - Validation failed (fail pipeline, fixable by user)
- `2` - System error (fail pipeline, configuration issue)

### Troubleshooting

**"Config not found"**  
Run `aligntrue init` before the check command, or add init to your CI setup:

```bash
- run: pnpm aligntrue init --non-interactive  # Future enhancement
- run: pnpm aligntrue check --ci
```

**"Lockfile drift"**  
Lockfile doesn't match current rules. Run `aligntrue sync` locally to regenerate the lockfile, then commit:

```bash
pnpm aligntrue sync
git add .aligntrue/lock.json
git commit -m "chore: update lockfile"
```

**"Schema validation failed"**  
Fix the errors listed in the output. Common issues:

- Missing required fields (`id`, `spec_version`, `rules`)
- Invalid severity values (must be `error`, `warn`, or `info`)
- Malformed YAML syntax

## Agent detection

AlignTrue automatically detects 28 AI coding agents:

**Core Exporters (Implemented):**

- Cursor (`.cursor/`)
- Universal AGENTS.md
- VS Code MCP (`.vscode/`)

**Additional Agents:**

- GitHub Copilot, Claude, Windsurf, Amazon Q, Cline, Goose
- Aider, Jules, Amp, Gemini, Qwen, Roo Code, Zed, Open Code
- Firebender, Kilocode, Kiro, Firebase Studio, Junie, Trae AI
- OpenHands, Augment Code, and more

Detection is automatic based on existing files/directories.

## Starter template

The comprehensive starter template includes 5 example rules:

1. **testing.require-tests** (warn) - Basic rule with applies_to patterns
2. **docs.update-readme** (info) - Demonstrates severity levels
3. **security.no-secrets** (error) - Shows machine-checkable regex validation
4. **style.consistent-naming** (warn) - Includes vendor.cursor.ai_hint metadata
5. **performance.avoid-n-plus-one** (warn) - Cross-agent applicability

Each rule demonstrates key features and best practices.

## Package status

✅ **Init command implemented** - Fully implemented with auto-detection and comprehensive UX
