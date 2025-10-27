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

### Other Commands

- `aligntrue sync` - Sync rules to agents (Step 23)
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

