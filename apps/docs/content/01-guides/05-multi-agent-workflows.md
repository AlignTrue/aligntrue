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
- Choosing the right workflow for multi-agent setups
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

sources:
  - type: local
    path: .aligntrue/.rules.yaml

exporters:
  - cursor # Cursor IDE
  - agents # GitHub Copilot, Claude Code, Aider
  - copilot # GitHub Copilot specific format
  - claude # Claude Code specific format
  - windsurf # Windsurf

sync:
  primary_agent: "agents" # Use AGENTS.md as source
  auto_pull: false # Disable for multi-agent
```

### Workflow

1. **Edit rules** in `AGENTS.md` or agent files:

```markdown
---
id: my-project.standards
version: "1.0.0"
spec_version: "1"
---

# My project rules

## Code standards

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
ls -la .windsurf/
```

### Verification

After syncing, you should see:

```
.cursor/rules/aligntrue.mdc    # Cursor format
AGENTS.md                       # Universal format
.windsurf/rules.md             # Windsurf format
```

Each file contains the same rules in agent-specific format.

## Configuration examples

> **More examples:** See [COMPARISON.md](https://github.com/AlignTrue/aligntrue/tree/main/examples/multi-agent/COMPARISON.md) in the multi-agent example for detailed agent comparison.

### Example 1: Cursor + Copilot + Claude Code

**Use case:** Using Cursor as primary editor, Copilot for suggestions, Claude Code for code review.

```yaml
version: "1"
mode: solo

sources:
  - type: local
    path: .aligntrue/.rules.yaml

exporters:
  - cursor # Primary editor
  - copilot # Code suggestions
  - claude # Code review
  - agents # Universal fallback

sync:
  primary_agent: "cursor"
  auto_pull: false

git:
  mode: commit # Commit all agent files
```

**Result:** All three agents get the same rules. Edit `AGENTS.md` once, sync to all.

### Example 2: VS Code ecosystem

**Use case:** VS Code with multiple MCP-enabled extensions.

```yaml
version: "1"
mode: solo

sources:
  - type: local
    path: .aligntrue/.rules.yaml

exporters:
  - vscode-mcp # VS Code MCP config
  - agents # Universal format
  - copilot # GitHub Copilot
  - cline # Cline extension

sync:
  primary_agent: "agents"
  auto_pull: false

git:
  mode: commit
```

**Result:** VS Code extensions and agents all read from consistent configs.

### Example 3: Universal format focus

**Use case:** Maximum compatibility with minimal config files.

```yaml
version: "1"
mode: solo

sources:
  - type: local
    path: .aligntrue/.rules.yaml

exporters:
  - agents # Universal format only

sync:
  workflow_mode: "native_format"
  auto_pull: true

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

## Choosing your workflow

### Manual review workflow (recommended)

**Best for multi-agent setups.**

Edit `AGENTS.md` or any agent file as your source. Review changes before syncing to other agents.

**Configuration:**

```yaml
sync:
  primary_agent: "agents"
  auto_pull: false # Important: disable for multi-agent
```

**Why this works:**

- Single source of truth (AGENTS.md or agent files)
- No conflicts between agents
- Clear edit → sync → deploy flow
- Works with any number of agents

**Workflow:**

```bash
# 1. Edit rules
vi AGENTS.md

# 2. Review changes (dry-run)
aligntrue sync --dry-run

# 3. Sync to all agents
aligntrue sync

# 4. Commit changes
git add .aligntrue/ .cursor/ AGENTS.md
git commit -m "Update rules"
```

### Agent-native workflow (advanced)

**Use with caution for multi-agent setups.**

Edit agent files directly. AlignTrue pulls changes back to internal IR.

**Configuration:**

```yaml
sync:
  primary_agent: "cursor" # Only one agent for auto-pull
  auto_pull: true
```

**Limitations with multiple agents:**

- Auto-pull only works with ONE primary agent
- Editing multiple agent files creates conflicts
- Harder to maintain consistency

**When to use:**

- You primarily use one agent (e.g., Cursor)
- Other agents are secondary/read-only
- You prefer agent's native UI for editing

**Workflow:**

```bash
# 1. Edit primary agent (Cursor)
vi .cursor/rules/aligntrue.mdc

# 2. Sync (auto-pulls from Cursor, pushes to others)
aligntrue sync

# 3. Other agents updated automatically
```

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
version: "1.0.0"
spec_version: "1"
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
- Creates unified `AGENTS.md` and `.aligntrue/.rules.yaml`

**Step 3: Review merged rules**

```bash
cat AGENTS.md
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

# Windsurf
ls -la .windsurf/
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
tail -20 .cursor/rules/aligntrue.mdc
tail -20 AGENTS.md
```

**Example fidelity note:**

```
Fidelity Notes:
- Machine-checkable rules (check) not represented in AGENTS.md format
- Autofix hints not represented in AGENTS.md format
```

**Solution:** Accept limitations or use agent-specific exporters for full feature support.

### Conflicts when editing multiple agents

**Problem:** Edited Cursor rules and AGENTS.md, now getting conflicts.

**Cause:** Auto-pull tries to pull from multiple sources.

**Fix:** Use IR-source workflow for multi-agent:

```yaml
# .aligntrue/config.yaml
sync:
  workflow_mode: "native_format" # Edit agent files
  auto_pull: true # Enable bidirectional sync
```

**Workflow:**

```bash
# 1. Enable bidirectional sync
aligntrue config set sync.workflow_mode native_format
aligntrue config set sync.auto_pull true

# 2. Edit any agent file
vi AGENTS.md
# or
vi .cursor/rules/aligntrue.mdc

# 3. Sync propagates changes to all agents
aligntrue sync
```

## Best practices

### 1. Use native format workflow for flexibility

Edit `AGENTS.md` or any agent file. AlignTrue keeps them all synced.

**Why:** Edit in the format you're most comfortable with, changes sync everywhere.

### 2. Primary editing file: AGENTS.md

Use `AGENTS.md` as your main editing file for universal compatibility.

**Why:** Works with all agents, simple format, easy to read and edit.

### 3. Use vendor bags sparingly

Only use vendor bags for truly agent-specific settings. Keep core rules consistent.

**Why:** Too many vendor bags make rules hard to maintain and understand.

### 4. Test sync with --dry-run first

Preview changes before writing files.

```bash
aligntrue sync --dry-run
```

**Why:** Catch issues before overwriting agent files.

### 5. Commit agent files to git (optional)

Decide whether to commit generated agent files.

**Commit agent files if:**

- Team members use different agents
- You want to see diffs in PRs
- You want backup of agent configs

**Don't commit if:**

- All team members regenerate on sync
- You want minimal git noise
- Agent files are large

```bash
# .gitignore (if not committing)
.cursor/rules/
AGENTS.md
.windsurf/
```

### 6. Document your agent setup

Add a note to your README:

```markdown
## AI agent setup

This project uses AlignTrue for consistent AI agent behavior.

**Supported agents:**

- Cursor
- GitHub Copilot
- Claude Code
- Windsurf

**Setup:**

<Tabs items={["npm", "yarn", "pnpm", "bun"]}>

<Tabs.Tab>`bash npm install -g aligntrue && aligntrue sync `</Tabs.Tab>

<Tabs.Tab>`bash yarn global add aligntrue && aligntrue sync `</Tabs.Tab>

<Tabs.Tab>`bash pnpm add -g aligntrue && aligntrue sync `</Tabs.Tab>

<Tabs.Tab>`bash bun install -g aligntrue && aligntrue sync `</Tabs.Tab>

</Tabs>
```

**Agents will automatically load rules from:**

- Cursor: `.cursor/rules/`
- Others: `AGENTS.md`

```

## Related documentation

- [Solo vs. team mode](/docs/00-getting-started/02-solo-vs-team-mode) - Solo vs team mode
- [Sync behavior](/docs/03-concepts/sync-behavior) - How sync works
- [Quickstart](/docs/00-getting-started/00-quickstart) - Get started quickly
- [Agent Support](/docs/04-reference/agent-support) - Full agent compatibility matrix
- [Vendor Bags Reference](/docs/04-reference/vendor-bags) - Agent-specific settings
- [Sync Behavior](/docs/03-concepts/sync-behavior) - Technical sync details

## Summary

**Multi-agent workflow checklist:**

- ✅ Configure multiple exporters in config.yaml
- ✅ Edit AGENTS.md or any agent file
- ✅ Enable bidirectional sync for flexibility
- ✅ Use vendor bags only for agent-specific settings
- ✅ Test with --dry-run before syncing
- ✅ Commit strategy (agent files or not)
- ✅ Document setup for team members

**Key takeaway:** AlignTrue makes multi-agent workflows simple by keeping all agent files synced automatically. Edit any file, changes flow everywhere.

```
