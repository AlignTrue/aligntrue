# @aligntrue/cli

Command-line interface for AlignTrue - the AI-native rules and alignment platform.

## Installation

```bash
pnpm install -g @aligntrue/cli
```

## Commands

- `aligntrue init` - Initialize AlignTrue in current directory (<60 seconds)
- `aligntrue sync` - Sync rules to agents (Cursor, AGENTS.md, VS Code MCP)
- `aligntrue check` - Validate rules and configuration
- `aligntrue import` - Import rules from agent configs
- `aligntrue migrate` - Migrate IR between versions

## Quick Start

```bash
cd your-project
aligntrue init
# Edit .aligntrue/rules.md
aligntrue sync
```

## Package Status

🚧 **Phase 1, Week 1** - Command scaffolds, implementation in progress

