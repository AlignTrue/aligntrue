---
title: About
description: A bit about AlignTrue.
---

# About

## The problem

You're using AI coding agents to boost productivity. Maybe Cursor, GitHub Copilot, Claude Code, or Aider. Each one is powerful, but they have a problem:

**Every agent has its own config format.**

- Cursor uses `.cursor/rules/*.mdc` files
- GitHub Copilot reads `AGENTS.md`
- VS Code MCP agents need `.vscode/mcp.json`
- Aider wants `.aider.conf.yml`

You copy-paste rules between projects. You maintain separate configs for each agent. Rules drift out of sync. You waste time keeping everything aligned.

## The AlignTrue solution

**Write rules once. Sync everywhere.**

```bash
# Edit rules in your preferred format
# (AGENTS.md shown, or any agent file)
AGENTS.md

# Syncs to all your agents
aligntrue sync

# Result:
✓ .aligntrue/.rules.yaml (internal IR, pure YAML)
✓ .cursor/rules/aligntrue.mdc (synced)
✓ AGENTS.md (synced)
✓ .vscode/mcp.json (synced)
✓ .aider.conf.yml (synced)
```

## Key benefits

### 1. Edit in your preferred format

Write rules in `AGENTS.md`, Cursor's `.mdc`, or any agent format. In solo mode, changes sync across all agents automatically via auto-pull.

### 2. Consistent behavior

All your AI agents follow the same rules. No more "it works in Cursor but not Copilot."

### 3. Easy sharing

Share rules across projects, teams, and machines. Git-based workflows with lockfiles and drift detection.

### 4. Two-way sync (in solo mode)

Edit rules in `AGENTS.md` or agent files. Auto-pull syncs changes automatically in solo mode (disabled in team mode for explicit reviews).

### 5. 28+ agents supported

Works with Cursor, GitHub Copilot, Claude Code, Aider, Windsurf, and 23+ more through 43 specialized exporters.

## Who is this for?

**Solo developers:**

- Keep personal AI rules consistent across projects
- Sync rules across multiple machines
- Try different agents without reconfiguring

**Teams:**

- Share approved rule sets via git
- Enforce standards with lockfiles
- Detect drift with CI validation
- Onboard new developers faster

## What's next?

Ready to get started? Follow the [Quickstart Guide](/docs/00-getting-started/00-quickstart) and be up and running in 60 seconds.

Want to understand how it works? Read about [Sync Behavior](/docs/03-concepts/sync-behavior).
