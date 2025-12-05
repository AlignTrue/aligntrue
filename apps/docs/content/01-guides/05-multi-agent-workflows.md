---
title: Multi-agent workflows
description: Use AlignTrue with multiple AI coding agents simultaneously
---

# Multi-agent workflows

Use AlignTrue to maintain consistent rules across multiple AI coding agents. Write rules once, sync to all agents automatically.

> **See it in action:** Check out the [multi-agent example](https://github.com/AlignTrue/aligntrue/tree/main/examples/multi-agent) for a working demonstration.

## Overview

This guide covers:

- Setting up AlignTrue with multiple agents (Cursor, Copilot, Claude Code, etc.)
- Handling agent-specific settings with vendor bags
- Migrating from existing multi-agent configurations
- Troubleshooting common multi-agent issues

**Who this is for:** Developers using 2+ AI coding agents who want consistent behavior without maintaining separate config files.

## Quick start: Same rules, multiple agents

The simplest and most common multi-agent workflow: maintain one set of rules that syncs to all agents.

### Configuration

Edit `.aligntrue/config.yaml`:

```yaml
version: "1"
mode: solo

exporters:
  - cursor # Cursor IDE
  - agents # GitHub Copilot, Claude Code, Aider
  - copilot # GitHub Copilot specific format
  - claude # Claude Code specific format
  - windsurf # Windsurf
```

### Workflow

1. **Edit rules** in `.aligntrue/rules/`:

```markdown
---
id: my-project.standards
---

# Code standards

Enable strict mode in tsconfig.json for better type safety.
```

2. **Sync to all agents**:

```bash
aligntrue sync
```

3. **Verify outputs**:

```bash
# Check generated files
ls -la .cursor/rules/
ls -la AGENTS.md
ls -la WINDSURF.md               # windsurf exporter
ls -la .windsurf/mcp_config.json # windsurf-mcp exporter (if enabled)
```

### Verification

After syncing, you should see:

```
.cursor/rules/*.mdc               # Cursor format (one file per rule)
AGENTS.md                         # Universal format
WINDSURF.md                       # Windsurf Markdown format
.windsurf/mcp_config.json         # Windsurf MCP config (when exporter enabled)
```

Each file contains the same rules in agent-specific format.

## Configuration examples

> **More examples:** See [COMPARISON.md](https://github.com/AlignTrue/aligntrue/tree/main/examples/multi-agent/COMPARISON.md) in the multi-agent example for detailed agent comparison.

### Example 1: Cursor + Copilot + Claude Code

**Use case:** Using Cursor as primary editor, Copilot for suggestions, Claude Code for code review.

```yaml
version: "1"
mode: solo

exporters:
  - cursor # Primary editor
  - copilot # Code suggestions
  - claude # Code review
  - agents # Universal fallback

git:
  mode: commit # Commit all agent files
```

**Result:** All three agents get the same rules. Edit `.aligntrue/rules/` once, sync to all.

### Example 2: VS Code ecosystem

**Use case:** VS Code with multiple MCP-enabled extensions.

```yaml
version: "1"
mode: solo

exporters:
  - vscode-mcp # VS Code MCP config
  - agents # Universal format
  - copilot # GitHub Copilot
  - cline # Cline extension

git:
  mode: commit
```

**Result:** VS Code extensions and agents all read from consistent configs.

### Example 3: Universal format focus

**Use case:** Maximum compatibility with minimal config files.

```yaml
version: "1"
mode: solo

exporters:
  - agents # Universal format only

git:
  mode: commit
```

**Result:** Single `AGENTS.md` file works with Copilot, Claude Code, Aider, and most other agents.

**Pros:**

- Minimal file count
- Maximum compatibility
- Simple git diffs

**Cons:**

- No agent-specific optimizations
- Some agents may not support all features

## Agent-specific settings (advanced)

Use vendor bags when you need different settings per agent while keeping core rules the same.

### Using vendor bags

Vendor bags preserve agent-specific metadata without duplicating rules.

**Example: Different AI hints per agent**

```yaml
rules:
  - id: typescript-strict
    summary: Use TypeScript strict mode
    severity: error
    guidance: |
      Enable strict mode in tsconfig.json.
    vendor:
      cursor:
        ai_hint: "Check tsconfig.json and suggest specific strict options"
        priority: high
      claude:
        mode: "assistant"
        context: "Focus on type safety benefits"
      copilot:
        suggestions: "conservative"
```

**Result:**

- All agents enforce the rule
- Each agent gets customized hints/behavior
- Core rule logic stays consistent

### When to use vendor bags

**Use vendor bags for:**

- Different AI hints per agent
- Agent-specific priorities or modes
- Metadata that doesn't affect rule logic

**Don't use vendor bags for:**

- Core rule logic (use `guidance`)
- Severity levels (use `severity` field)
- File patterns (use `applies_to`)

If you find yourself using vendor bags extensively, consider whether you actually need different rules per agent.

### Example: Different hints per agent

Full example with three agents:

```markdown
---
id: my-project.code-review
---

# Code review rules

## Testing requirements

Write unit tests for all new features.
Test files should be co-located: src/foo.ts → src/foo.test.ts

### For Cursor

Suggest test file path and basic test structure (with quick fix enabled)

### For Claude

Emphasize test coverage and edge cases in reviewer mode

### For Copilot

Provide detailed suggestions with examples
```

## Migration from existing setup

### Importing from multiple agents

AlignTrue can detect and import from multiple agents automatically.

**Step 1: Run init**

```bash
aligntrue init
```

**Output:**

```
✓ Detected existing configs:
  • Cursor (.cursor/rules/*.mdc)
  • AGENTS.md
  • Aider (.aider.conf.yml)

? Import rules from these sources? (Y/n)
```

**Step 2: AlignTrue merges all sources**

- Deduplicates identical rules
- Preserves agent-specific settings in vendor bags
- Creates unified rules in `.aligntrue/rules/`

**Step 3: Review merged rules**

```bash
ls .aligntrue/rules/
```

**Step 4: Sync to all agents**

```bash
aligntrue sync
```

### Consolidating rules

After import, you may have duplicate or similar rules. Consolidate them:

**Before (duplicates):**

```yaml
rules:
  # From Cursor
  - id: cursor.no-console
    summary: No console.log
    severity: error

  # From AGENTS.md
  - id: copilot.no-console
    summary: Avoid console.log
    severity: warn
```

**After (consolidated):**

```yaml
rules:
  - id: no-console-log
    summary: No console.log in production code
    severity: error
    guidance: |
      Use proper logging library instead of console.log.
    vendor:
      cursor:
        ai_hint: "Suggest logger.info() or logger.error()"
      copilot:
        suggestions: "Show logging library examples"
```

## Troubleshooting

### Rules not syncing to all agents

**Problem:** Some agents not getting updated rules.

**Check:**

1. Verify exporters in config:

```bash
cat .aligntrue/config.yaml | grep -A 10 exporters
```

2. Check for sync errors:

```bash
aligntrue sync --dry-run
```

3. Verify agent file paths:

```bash
# Cursor
ls -la .cursor/rules/

# Universal
ls -la AGENTS.md

# Windsurf Markdown exporter
ls -la WINDSURF.md

# Windsurf MCP exporter (if enabled)
ls -la .windsurf/mcp_config.json
```

**Fix:**

```bash
# Add missing exporters
aligntrue config edit
# Add to exporters array

# Sync again
aligntrue sync
```

### Different behavior across agents

**Problem:** Agents behave differently despite same rules.

**Expected differences:**

- **Fidelity:** Some agents support more features than others
- **Interpretation:** Agents may interpret guidance differently
- **Timing:** Some agents apply rules in real-time, others on save

**Check fidelity notes:**

```bash
# Look for fidelity notes in exported files
tail -20 .cursor/rules/*.mdc
tail -20 AGENTS.md
```

**Example fidelity note:**

```
Fidelity Notes:
- Machine-checkable rules (check) not represented in AGENTS.md format
- Autofix hints not represented in AGENTS.md format
```

**Solution:** Accept limitations or use agent-specific exporters for full feature support.

## Best practices

### 1. Single source of truth

Edit rules in `.aligntrue/rules/` only. All agent files are read-only exports.

**Why:** Prevents conflicts and ensures consistency across all agents.

### 2. Use vendor bags sparingly

Only use vendor bags for truly agent-specific settings. Keep core rules consistent.

**Why:** Too many vendor bags make rules hard to maintain and understand.

### 3. Test sync with --dry-run first

Preview changes before writing files.

```bash
aligntrue sync --dry-run
```

**Why:** Catch issues before overwriting agent files.

### 4. Handle agent exports in git

- Exports are generated artifacts. Default git mode for solo/team is `ignore`, so keep them gitignored and regenerate with `aligntrue sync` (dev + CI).
- Commit exports only when required (compliance snapshot, downstream handoff without AlignTrue, or a specific exporter that must be reviewed). Use per-exporter overrides if needed.
- Ignoring exports does **not** break agents; they load whatever is on disk after sync.

Recommended `.gitignore` when not committing:

```bash
.cursor/rules/
AGENTS.md
WINDSURF.md
.windsurf/mcp_config.json
```

### 5. Document your agent setup

Add a note to your README:

````markdown
## AI agent setup

This project uses AlignTrue for consistent AI agent behavior.

**Supported agents:**

- Cursor
- GitHub Copilot
- Claude Code
- Windsurf

**Setup:**

```bash
npm install -g aligntrue && aligntrue sync
```
````

**Agents will automatically load rules from:**

- Cursor: `.cursor/rules/`
- Windsurf: `WINDSURF.md` (or `.windsurf/mcp_config.json` if using MCP exporter)
- Others: `AGENTS.md`

```

## Related documentation

- [Solo vs. team mode](/docs/00-getting-started/02-solo-vs-team-mode) - Solo vs team mode
- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync works
- [Quickstart](/docs/00-getting-started/00-quickstart) - Get started quickly
- [Agent Support](/docs/04-reference/agent-support) - Full agent compatibility matrix
- [Vendor Bags Reference](/docs/04-reference/vendor-bags) - Agent-specific settings

## Summary

**Multi-agent workflow checklist:**

- Configure multiple exporters in config.yaml
- Edit rules in `.aligntrue/rules/` (single source of truth)
- Use vendor bags only for agent-specific settings
- Test with --dry-run before syncing
- Decide commit strategy (agent files or not)
- Document setup for team members

**Key takeaway:** AlignTrue makes multi-agent workflows simple by keeping all agent files synced automatically. Edit rules once in `.aligntrue/rules/`, changes flow to all agents.
```
