# @aligntrue/cli

Command-line interface for AlignTrue - the AI-native rules and alignment platform.

**YAML Library**: This package uses `yaml` for config generation and CLI operations (user-facing formatting). See [docs/yaml-libraries.md](../../docs/yaml-libraries.md) for rationale.

## Installation

```bash
pnpm install -g @aligntrue/cli
```

## Quick Reference

```
AlignTrue CLI - AI-native rules and alignment platform

Usage: aligntrue <command> [options]

Basic Commands:
  init           Initialize AlignTrue in current directory
  sync           Sync rules to agents
  import         Import rules from agent configs
  check          Validate rules and configuration

Development Commands:
  adapters       Manage exporters (list, enable, disable)
  md             Markdown validation and formatting

Team Commands:
  team           Team mode management
  scopes         List configured scopes

Settings:
  telemetry      Telemetry settings

Coming Soon:
  migrate        Schema migration (preview mode)

Run aligntrue <command> --help for command-specific options
```

**Help is fast:** ~95ms response time for `--help`

**Flag grouping:** Each command organizes flags into Basic/Advanced sections for easier discovery

**Error messages:** All errors follow what/why/how format with actionable fixes

## Command Development

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
- `.aligntrue/rules.md` - Starter template with educational examples

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
│    - .aligntrue/rules.md
│
◇  Continue?
│  Yes
│
◇  Files created
│  ✓ Created .aligntrue/config.yaml
│  ✓ Created .aligntrue/rules.md
│
◇  Run sync now?
│  Yes
│
└  Next steps:
     1. Edit rules: .aligntrue/rules.md
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

- `agent` - Agent format to analyze (cursor, agents-md, copilot, claude-code, aider)

**Options:**

- `--coverage` - Show import coverage report (default: true)
- `--no-coverage` - Skip coverage report
- `--write` - Write imported rules to .aligntrue/rules.md
- `--dry-run` - Preview without writing files
- `--help, -h` - Show help message

**Examples:**

Analyze Cursor rules with coverage:

```bash
aligntrue import cursor
```

Import from AGENTS.md:

```bash
aligntrue import agents-md
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
- **agents-md** - `AGENTS.md` universal markdown format
- **copilot** - AGENTS.md format (alias)
- **claude-code** - AGENTS.md format (alias)
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
Supported agents: cursor, agents-md, copilot, claude-code, aider
```

**No rules found:**

```
⚠ No rules found in agent format
Check that .mdc files contain valid rules with ## Rule: headers
```

### `aligntrue sync`

Sync your rules to configured agent exporters (Cursor, AGENTS.md, VS Code MCP, etc.).

**Features:**

- Default: IR → agents sync (rules.md to agent config files)
- Pullback: agents → IR sync with `--accept-agent` flag
- Preview changes with `--dry-run` before writing
- Non-interactive mode for CI with `--force`
- Lockfile validation in team mode (soft/strict enforcement)
- Comprehensive error messages with actionable fixes

**Usage:**

```bash
aligntrue sync [options]
```

**Basic Options:**

- `--dry-run` - Preview changes without writing files
- `--config <path>` - Custom config file path (default: .aligntrue/config.yaml)

**Advanced Options:**

- `--accept-agent <name>` - Pull changes from agent back to IR (requires Step 17)
- `--force` - Non-interactive mode (skip prompts)

**Examples:**

Default sync (IR → agents):

```bash
aligntrue sync
```

Preview changes:

```bash
aligntrue sync --dry-run
```

Import from Cursor (mock data):

```bash
aligntrue sync --accept-agent cursor
```

Non-interactive for CI:

```bash
aligntrue sync --force
```

**What it does:**

1. Loads `.aligntrue/config.yaml` configuration
2. Validates source file exists (default: `.aligntrue/rules.md`)
3. Discovers and loads exporters from registry
4. Resolves hierarchical scopes (if configured)
5. Validates lockfile (team mode only)
6. Syncs IR to agent config files
7. Shows files written, warnings, conflicts

**Output example:**

```
┌  AlignTrue Sync
│
◇  Configuration loaded
│
◇  Loaded 2 exporters
│  ✓ Active: cursor, agents-md
│
◇  Sync complete
│  ✓ Wrote 2 files
│    .cursor/rules/aligntrue.mdc
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
✗ Source file not found: .aligntrue/rules.md
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
  3. Commit both config.yaml and .aligntrue.lock.json

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

### `aligntrue telemetry`

Manage anonymous telemetry collection settings.

**Features:**

- Opt-in only (disabled by default)
- Anonymous usage data (no code, no paths, no PII)
- Collects: command names, export targets, content hashes

**Usage:**

```bash
aligntrue telemetry on|off|status
```

**Subcommands:**

- `on` - Enable telemetry collection
- `off` - Disable telemetry collection
- `status` - Show current telemetry status

**Examples:**

Enable telemetry:

```bash
aligntrue telemetry on
```

Check status:

```bash
aligntrue telemetry status
# Output: Telemetry: enabled
```

Disable telemetry:

```bash
aligntrue telemetry off
```

**What we collect (when enabled):**

- Command name (init, sync, etc.)
- Export targets used (cursor, agents-md, etc.)
- Align content hashes (no code, no paths, no PII)

**What we never collect:**

- Repository names or paths
- Rule content or guidance text
- File paths or directory structures
- Any personally identifiable information

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

### `aligntrue adapters`

Manage exporters (adapters) in your configuration. View available adapters, enable/disable them, and discover all 43 supported AI coding agents.

**Features:**

- List all 43 available adapters with descriptions
- Show install status (✓ installed, - available, ❌ invalid)
- Enable/disable adapters interactively or by name
- Prevents disabling the last adapter

#### `aligntrue adapters list`

Show all discovered adapters with their current status:

```bash
aligntrue adapters list
```

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

❌ invalid-adapter         (Not found in available adapters)

Summary:
  ✓ Installed: 2
  - Available: 41
  ❌ Invalid: 1
```

**Status indicators:**

- `✓` - Installed (enabled in your config)
- `-` - Available (discovered but not enabled)
- `❌` - Invalid (in config but not found)

#### `aligntrue adapters enable <adapter>`

Enable an adapter by adding it to your config:

```bash
aligntrue adapters enable claude-md
```

**Example output:**

```
✓ Enabled adapter: claude-md

Next step:
  Run: aligntrue sync
```

**Interactive mode:**

Choose multiple adapters with a visual multiselect interface:

```bash
aligntrue adapters enable --interactive
# or
aligntrue adapters enable -i
```

The interactive prompt pre-selects currently enabled adapters and lets you toggle any available adapters.

#### `aligntrue adapters disable <adapter>`

Disable an adapter by removing it from your config:

```bash
aligntrue adapters disable claude-md
```

**Safety:**

- Cannot disable the last adapter (at least one must be configured)
- Shows clear error if adapter isn't currently enabled

**Example output:**

```
✓ Disabled adapter: claude-md
```

### Telemetry Commands

AlignTrue includes optional, anonymous telemetry to help improve the product.

#### `aligntrue telemetry on`

Enable anonymous telemetry collection:

```bash
aligntrue telemetry on
```

**What we collect:**

- Command names (init, sync, etc.)
- Export targets used (cursor, agents-md, etc.)
- Rule content hashes (SHA-256, no actual content)

**What we never collect:**

- File paths or repository names
- Rule content or code
- Personally identifiable information (PII)

**Storage:** Local only in Phase 1 (`.aligntrue/telemetry-events.json`), with optional sending in Phase 2+ after explicit consent.

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
- Lockfile drift (team mode only, validates `.aligntrue.lock.json` matches current rules)

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
  Lockfile: .aligntrue.lock.json matches current rules
```

**Example output (failure):**

```
✗ Schema validation failed

  Errors in .aligntrue/rules.md:
    - spec_version: Missing required field
    - rules[0].id: Missing required field

  Fix the errors above and run 'aligntrue check --ci' again.
```

### Other Commands

- `aligntrue import` - Import rules from agent configs (coming soon)
- `aligntrue md` - Markdown validation and formatting (Step 4 ✓)
- `aligntrue migrate` - Migration status (Step 24 ✓)

## Quick Start

```bash
cd your-project
aligntrue init
# Edit .aligntrue/rules.md
aligntrue sync
```

## CI Integration

AlignTrue integrates seamlessly with CI/CD pipelines and pre-commit hooks using the `aligntrue check --ci` command.

### Pre-commit Hooks

Validate rules before committing to prevent broken configurations from entering version control.

#### Manual Installation

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

### Other CI Systems

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

### Exit Codes

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
git add .aligntrue.lock.json
git commit -m "chore: update lockfile"
```

**"Schema validation failed"**  
Fix the errors listed in the output. Common issues:

- Missing required fields (`id`, `spec_version`, `rules`)
- Invalid severity values (must be `error`, `warn`, or `info`)
- Malformed YAML syntax

## Agent Detection

AlignTrue automatically detects 28 AI coding agents:

**Phase 1 Exporters:**

- Cursor (`.cursor/`)
- Universal AGENTS.md
- VS Code MCP (`.vscode/`)

**Additional Agents:**

- GitHub Copilot, Claude, Windsurf, Amazon Q, Cline, Goose
- Aider, Jules, Amp, Gemini, Qwen, Roo Code, Zed, Open Code
- Firebender, Kilocode, Kiro, Firebase Studio, Junie, Trae AI
- OpenHands, Augment Code, and more

Detection is automatic based on existing files/directories.

## Starter Template

The comprehensive starter template includes 5 example rules:

1. **testing.require-tests** (warn) - Basic rule with applies_to patterns
2. **docs.update-readme** (info) - Demonstrates severity levels
3. **security.no-secrets** (error) - Shows machine-checkable regex validation
4. **style.consistent-naming** (warn) - Includes vendor.cursor.ai_hint metadata
5. **performance.avoid-n-plus-one** (warn) - Cross-agent applicability

Each rule demonstrates key features and best practices.

## Package Status

✅ **Phase 1, Step 22 Complete** - Init command fully implemented with auto-detection and comprehensive UX
