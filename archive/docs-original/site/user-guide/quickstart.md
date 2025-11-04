# Quickstart guide

Get AlignTrue running in under 60 seconds. No prior knowledge required.

## Try the golden repository

The fastest way to see AlignTrue in action is to explore the golden repository - a complete, working example with 5 practical rules.

```bash
git clone https://github.com/AlignTrue/aligntrue.git
cd aligntrue/examples/golden-repo
node ../../packages/cli/dist/index.js sync
```

This generates three outputs in under 5 seconds:

- `.cursor/rules/aligntrue.mdc` - Cursor rules with content hash
- `AGENTS.md` - Universal format for Claude, Copilot, Aider
- `.vscode/mcp.json` - VS Code MCP configuration

**Learn more:** See `examples/golden-repo/README.md` for a detailed walkthrough.

## Prerequisites

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm** - `npm install -g pnpm`

## Installation

```bash
# Add to your project
pnpm add -D @aligntrue/cli

# Or use without installing
npx @aligntrue/cli init
```

## Quick start

### 1. Initialize your project

```bash
aligntrue init
```

AlignTrue automatically detects AI coding agents in your workspace (Cursor, GitHub Copilot, Claude Code, etc.) and creates:

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

### 2. Edit your rules

Open `.aligntrue/rules.md` and customize the starter rules:

````markdown
# My Project Rules

## Global standards

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

````

The starter template includes examples for:

- Code style enforcement
- Testing requirements
- Documentation standards
- Security practices
- AI-specific hints (optional)

### 3. Sync to your agents

```bash
aligntrue sync
````

This generates agent-specific files from your rules:

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

After running `aligntrue sync`, you'll have:

### For Cursor

- `.cursor/rules/aligntrue.mdc` - Rules in Cursor's native format with YAML frontmatter

### For GitHub Copilot, Claude Code, Aider, and others

- `AGENTS.md` - Universal markdown format readable by multiple agents

### For VS Code with MCP

- `.vscode/mcp.json` - Model Context Protocol configuration (if enabled)

### Other agents

AlignTrue supports 28+ AI coding agents. Enable additional agents in `.aligntrue/config.yaml`:

```yaml
exporters:
  - cursor
  - agents-md
  - windsurf
  - claude-md
  - cline
  # ... and 23 more
```

See `aligntrue adapters list` for the complete list.

### Using git sources (optional)

Pull rules from any git repository by adding to your config:

```yaml
sources:
  - type: git
    url: https://github.com/yourorg/rules
    ref: main
    path: .aligntrue.yaml
```

First sync will prompt for privacy consent. See [Git Sources Guide](git-sources.md) for full documentation on branches, tags, caching, and troubleshooting.

## Next steps

### Learn more commands

- `aligntrue sync --dry-run` - Preview changes without writing files
- `aligntrue check` - Validate rules (great for CI)
- `aligntrue md lint` - Check markdown syntax

See [Command Reference](commands.md) for all available commands.

### Explore examples

Check `examples/markdown/` in the AlignTrue repository for more rule examples.

### Troubleshooting

Run into issues? See [Troubleshooting Guide](troubleshooting.md) for common solutions.

### Auto-sync on save (optional)

Want rules to sync automatically when you save? Set up a file watcher:

```bash
# Quick option (VS Code)
# Add to .vscode/tasks.json - see file-watcher-setup.md

# Universal option (any editor)
npm install -g nodemon
nodemon --watch .cursor/rules --watch AGENTS.md --exec "aligntrue sync"
```

**Full guide:** See [File Watcher Setup](file-watcher-setup.md) for platform-specific instructions (VS Code, macOS, Linux, Windows).

### Advanced features

When your project grows, explore:

- **Team Mode** - Shared rules with lockfile validation (see below)
- **Hierarchical Scopes** - Different rules for different directories
- **Custom Exporters** - Add support for new agents ([Extending Guide](extending-aligntrue.md))

### Team mode (5-minute setup)

Enable team mode for collaborative rule management with lockfiles and allow lists.

**For repository owners:**

```bash
# 1. Enable team mode
aligntrue team enable

# 2. Approve rule sources
aligntrue team approve sha256:abc123...

# 3. Sync to generate lockfile
aligntrue sync

# 4. Commit team files
git add .aligntrue/
git commit -m "Enable AlignTrue team mode"
```

**For team members:**

```bash
# Clone and sync (validated against allow list)
git clone <repo> && cd <repo>
aligntrue sync
```

**See:** [Team Mode Guide](team-mode.md) for complete workflows.

---

**That's it!** You now have consistent AI rules across all your coding agents.

**Workflow:**

1. Edit rules in your preferred format (`.cursor/*.mdc`, `AGENTS.md`, or `.aligntrue/rules.md`)
2. Save changes
3. Run `aligntrue sync` (or set up auto-sync)
