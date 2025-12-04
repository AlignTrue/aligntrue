---
title: Per-rule export targeting
description: Control which agents receive specific rules using frontmatter options
---

# Per-rule export targeting

While AlignTrue syncs all your rules to all enabled exporters by default, you can target specific rules to specific agents using frontmatter options. This is useful for agent-specific guidance, debugging rules, or performance-critical configurations.

## Why target rules per agent?

**Common use cases:**

- **Agent-specific guidance**: Cursor-specific debugging strategies that don't apply to other agents
- **Performance optimization**: Memory or speed hints specific to one agent's capabilities
- **Compliance requirements**: Certain rules only needed for specific tools
- **Experimental features**: Try new guidance in one agent before rolling out to all
- **Simplified exports**: Keep exports minimal for single-agent projects by excluding irrelevant rules

## How it works

Each rule file can specify which agents should receive it:

- Use the exporter ids you have enabled in config (for example `cursor`, `agents-md`, `windsurf`, `windsurf-mcp`). Names must match exactly.
- If you omit targeting, the rule goes to every enabled exporter.

```markdown
---
title: Cursor Debugging Strategies
export_only_to: [cursor]
---

## Debugging in Cursor

Use Cursor's debugging features to trace execution...
```

```markdown
---
title: General Architecture
exclude_from: []
---

## Architecture Principles

These apply to all agents...
```

## Frontmatter options

### `export_only_to`

Explicitly list agents that should receive this rule. **All other agents are excluded.**

**Syntax:**

```yaml
export_only_to: [cursor, claude]
```

**Example:**

```markdown
---
title: TypeScript Performance Tips
export_only_to: [cursor, amazon-q, kilocode]
---

These agents support TypeScript with high performance...
```

**Result:** Only Cursor, Amazon Q, and KiloCode receive this rule. Copilot, Claude, etc. do not.

### `exclude_from`

List agents that should NOT receive this rule. **All other agents are included.**

**Syntax:**

```yaml
exclude_from: [cursor]
```

**Example:**

```markdown
---
title: Generic AI Guidelines
exclude_from: [copilot]
---

General guidelines for all agents except Copilot...
```

**Result:** All agents receive this rule except Copilot.

## Combining options

You can use both options together for clarity. The more restrictive setting wins:

```markdown
---
title: Architecture Standards
export_only_to: [cursor, claude, amazon-q]
exclude_from: [claude]
---
```

In this case:

- `export_only_to` says: only these 3 agents
- `exclude_from` says: exclude claude
- **Result:** Only Cursor and Amazon Q receive this rule

## Common patterns

### 1. Shared core rules

Most rules apply to all agents:

```markdown
---
title: Security Best Practices
---

Security guidelines for all agents...
```

No targeting needed. This goes everywhere.

### 2. Agent-specific advanced tips

For Cursor-specific features:

```markdown
---
title: Cursor IDE Features
export_only_to: [cursor]
---

Leverage Cursor's built-in features...
```

### 3. Experimental or draft rules

Test new guidance in one agent:

```markdown
---
title: Experimental Testing Approach
export_only_to: [cursor]
---

Testing approach currently under evaluation...
```

### 4. Legacy compatibility

Some rules needed for older agents:

```markdown
---
title: Legacy Coding Standards
exclude_from: [claude]
---

For agents without modern language support...
```

### 5. Multi-agent teams with role separation

```markdown
---
title: Frontend Guidelines
export_only_to: [cursor, copilot]
---

Frontend-specific guidance...
```

## How targeting affects export

### For native multi-file agents

Cursor, Amazon Q, KiloCode, Augment Code, Kiro, Trae AI:

- If `export_only_to: [cursor]`: Only `.cursor/rules/rule.mdc` is written
- If `exclude_from: [cursor]`: Rule is skipped, `.cursor/rules/rule.mdc` is **not** written
- Otherwise: Rule writes to `.cursor/rules/rule.mdc`

Targets must match enabled exporters. If a rule only targets exporters that are not enabled, it is skipped and `aligntrue sync` logs a warning.

### For AGENTS.md

Copilot, GitHub Copilot, Aider, Claude, etc.:

- If `export_only_to: [copilot]`: Section appears in `AGENTS.md`
- If `exclude_from: [copilot]`: Section does NOT appear in `AGENTS.md`
- Otherwise: Section appears in `AGENTS.md`

### Finding what each agent actually receives

Use the CLI to see which rules go to which agents:

```bash
aligntrue rules list --by-agent
```

Output:

```
Rules by agent:

  cursor (native format):
    - architecture.md
    - security.md
    - testing.md (via export_only_to)

  claude (native format):
    - architecture.md
    - security.md
    (excludes: testing.md via exclude_from)

  agents-md (Copilot, GitHub Copilot, etc.):
    - architecture.md
    - security.md
```

If you see a warning about rules targeting disabled exporters, enable the exporter in config or remove `export_only_to` from that rule.

## Sync behavior

Targeting is evaluated on every sync:

1. **Edit a rule file**: Change `export_only_to` or `exclude_from`
2. **Run sync**: `aligntrue sync`
3. **Targeting updates**: Agent files are regenerated based on new targeting
4. **Cleanup**: If a rule is removed from an agent's targeting, that agent's file(s) are cleaned up

### Example: Remove a rule from Cursor

**Before:**

```yaml
# .aligntrue/rules/cursor-debug.md
---
title: Cursor Debugging
export_only_to: [cursor]
---
```

Exports to: `.cursor/rules/cursor-debug.mdc`

**After (edit and sync):**

```yaml
# .aligntrue/rules/cursor-debug.md
---
title: Cursor Debugging
export_only_to: [claude] # Changed from cursor to claude
---
```

Next sync:

- `aligntrue sync` regenerates exports
- `.cursor/rules/cursor-debug.mdc` is **removed** (rule no longer targets Cursor)
- Claude receives the rule instead

## Best practices

### When to use targeting

**Use targeting when:**

- A rule is genuinely specific to one or a few agents
- You want to minimize noise (don't send irrelevant rules)
- You're testing new guidance in a subset of agents
- Compliance or security requires limiting where rules go

**Don't use targeting for:**

- Normal rules that apply broadly (keep them universal)
- Duplicating similar guidance per agent (consider a better approach)
- Overly complex inclusion/exclusion logic (simplify instead)

### Naming conventions

Make targeting obvious in rule filenames:

```
.aligntrue/rules/
├── architecture.md            # Universal, applies to all agents
├── cursor-specific.md         # Clearly Cursor-only
├── experimental-testing.md    # Experimental, check targeting in frontmatter
└── security.md                # Universal security
```

### Documentation

Always document why targeting is needed:

```markdown
---
title: Cursor Keyboard Shortcuts
export_only_to: [cursor]
description: Cursor-specific keyboard optimization (not applicable to other agents)
---

# Keyboard Shortcuts in Cursor

Cursor has specific keyboard bindings...
```

## Advanced: Combining with scopes

Targeting and scopes work together:

```markdown
---
title: Frontend Testing
scope: apps/web # Only applies to apps/web
export_only_to: [cursor] # Only export to Cursor
---

Testing strategies for the web frontend...
```

Result: Only Cursor gets this rule, and only for the `apps/web` scope.

## Troubleshooting

### Rule not appearing for an agent

1. Check `export_only_to`: Is the agent listed?
2. Check `exclude_from`: Is the agent excluded?
3. Check that the exporter is enabled in your config (run `aligntrue rules list --by-agent` to confirm names).
4. Check `enabled`: Is the rule enabled? (defaults to true)
5. Check `scope`: Does the scope match your project structure?
6. Run `aligntrue sync` and look for warnings about skipped targets.

### Rule appearing where it shouldn't

1. Verify `export_only_to` is set correctly
2. Verify `exclude_from` doesn't have typos
3. Check agent/exporter names in targeting match config exactly
4. Run `aligntrue sync --verbose` to see targeting decisions

## Related documentation

- [Multi-file rule organization](/docs/02-customization/multi-file-organization) - Organizing rules across files
- [Scopes](/docs/02-customization/scopes) - Path-based rule application for monorepos
- [Agent support](/docs/04-reference/agent-support) - Which agents are supported
- [Config reference](/docs/04-reference/config-reference) - Configuration options
