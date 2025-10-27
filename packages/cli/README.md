# @aligntrue/cli

Command-line interface for AlignTrue - the AI-native rules and alignment platform.

## Installation

```bash
pnpm install -g @aligntrue/cli
```

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

**Options:**
- `--dry-run` - Preview changes without writing files
- `--accept-agent <name>` - Sync from agent to IR (Note: uses mock data, real parsers in Step 17)
- `--force` - Non-interactive mode for CI
- `--config <path>` - Custom config path (default: .aligntrue/config.yaml)

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

### Other Commands

- `aligntrue check` - Validate rules and configuration (Step 25)
- `aligntrue import` - Import rules from agent configs (Step 17)
- `aligntrue md` - Markdown validation and formatting (Step 4 ✓)
- `aligntrue migrate` - Migration status (Step 24 ✓)

## Quick Start

```bash
cd your-project
aligntrue init
# Edit .aligntrue/rules.md
aligntrue sync
```

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

