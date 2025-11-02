# Quickstart guide

Get AlignTrue running in under 60 seconds. No prior knowledge required.

## What is AlignTrue?

AlignTrue helps you control how AI coding assistants behave in your project. You write rules once in a simple format, and AlignTrue converts them into each agent's specific format automatically.

**Key terms:**

- **Rules** - Guidelines that tell AI agents how to work in your project (e.g., "use TypeScript strict mode")
- **Sync** - Convert your rules into agent-specific formats (like `.cursor/rules/*.mdc` or `AGENTS.md`)
- **Agents** - AI coding assistants like Cursor, GitHub Copilot, Claude Code, etc.

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **An AI coding agent** - Cursor, GitHub Copilot, Claude Code, or any of [28+ supported agents](/reference/cli-reference#supported-agents)

## Installation

Install AlignTrue globally to use it in any project:

```bash
npm install -g @aligntrue/cli
```

**Verify installation:**

```bash
aligntrue --version
```

## Quick start

### 1. Initialize your project

Open a terminal, navigate to your project directory, and run:

```bash
cd your-project
aligntrue init
```

**What this does:** AlignTrue scans your project for AI agents (like Cursor or Copilot) and creates:

- `.aligntrue/config.yaml` - Configuration with detected agents enabled
- `.aligntrue/rules.md` - Starter template with 5 example rules

**Example output:**

```
◇ Detected 2 AI coding agents:
│  • Cursor (.cursor/)
│  • GitHub Copilot (AGENTS.md)
│
◇ Project ID: my-awesome-project
│
◆ Created 2 files:
│  • .aligntrue/config.yaml
│  • .aligntrue/rules.md
│
◇ Run sync now? Yes
```

### 2. Customize your rules

Open `.aligntrue/rules.md` and edit the starter rules for your project:

````markdown
# My Project Rules

## Global Standards

```aligntrue
id: my-project.global.code-style
version: "1.0.0"
spec_version: "1"
rules:
  - id: use-typescript-strict
    summary: Use TypeScript strict mode in all files
    severity: error
    applies_to:
      patterns: ["**/*.ts", "**/*.tsx"]
    guidance: |
      Enable strict mode in tsconfig.json for better type safety.
```
````

The starter template includes examples for:

- Code style enforcement
- Testing requirements
- Documentation standards
- Security practices

### 3. Sync to your agents

Run this command (in your project directory) to generate agent-specific files:

```bash
aligntrue sync
```

**What this does:** Converts your rules from `.aligntrue/rules.md` into formats that each AI agent understands.

**Example output:**

```
◇ Loading configuration...
◇ Parsing rules...
◇ Syncing to 2 agents...
│
◆ Files written:
│  • .cursor/rules/aligntrue.mdc (3 rules)
│  • AGENTS.md (3 rules)
│
◇ Sync complete! No conflicts detected.
```

## What you get

After running `aligntrue sync`, you'll have agent-specific rule files:

**For Cursor:**

- `.cursor/rules/aligntrue.mdc` - Rules in Cursor's native format

**For GitHub Copilot, Claude Code, Aider, and others:**

- `AGENTS.md` - Universal markdown format

**For VS Code with MCP:**

- `.vscode/mcp.json` - Model Context Protocol configuration (if enabled)

## Next steps

**Want to try a working example first?** See [Try the Example](/getting-started/try-example) for a complete working demo.

**Ready to learn more?** Check out [Next Steps](/getting-started/next-steps) for:

- Auto-sync on save
- Team collaboration features
- Git-based rule sharing
- Custom exporters

**Run into issues?** See [Troubleshooting Guide](/reference/troubleshooting) for common solutions.

---

**That's it!** You now have consistent AI rules across all your coding agents.

**Basic workflow:**

1. Edit rules in `.aligntrue/rules.md`
2. Run `aligntrue sync`
3. Your AI agents now follow your project's standards
