---
title: Migration guide
description: Migrate from existing agent configurations to AlignTrue
---

# Migration guide

Quick guide for moving existing rules from other AI coding agents to AlignTrue.

## Overview

AlignTrue uses natural markdown for rules. If you have existing rules in other formats, copy them manually into `AGENTS.md`, then let AlignTrue sync to all agents.

No special import command needed - just copy, paste, and sync.

## Migration steps

### 1. Copy existing rules

Open your existing rule files and copy the content:

- **Cursor**: `.cursor/rules/*.mdc` files
- **AGENTS.md**: Already in the right format
- **Windsurf**: `.windsurf/rules.md`
- **Claude**: `CLAUDE.md` or `.claude/instructions.md`
- **Other agents**: Copy rule text from their format

### 2. Create AGENTS.md

Paste into `AGENTS.md` using natural markdown:

```markdown
# Project Rules

## Use TypeScript strict mode

Enable strict mode for better type safety.

Check `tsconfig.json` has `"strict": true`.

## Write tests for new features

All new features should include tests.

Use the test framework: `pnpm test`
```

Keep it simple - just headings and prose. No special syntax required.

### 3. Initialize AlignTrue

```bash
aligntrue init
```

This creates `.aligntrue/config.yaml` and `.aligntrue/.rules.yaml` (internal representation).

### 4. Sync to all agents

```bash
aligntrue sync
```

AlignTrue exports your rules to all configured agents. That's it!

## Agent-specific examples

### Migrating from Cursor

**Before** (`.cursor/rules/global.mdc`):

````markdown
---
description: Global project rules
alwaysApply: true
---

## TypeScript Configuration

Use strict mode in all TypeScript files.

Enable in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```
````

````

**After** (`AGENTS.md`):

```markdown
# Project Rules

## TypeScript Configuration

Use strict mode in all TypeScript files.

Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true
  }
}
````

````

Then run:

```bash
aligntrue init
aligntrue sync
````

Cursor's `.mdc` files will be regenerated from your `AGENTS.md` source.

### Migrating from AGENTS.md only projects

If you already have `AGENTS.md`, you're halfway there!

**Before**:

```
project/
├── AGENTS.md  (your existing rules)
└── ...
```

**After**:

```bash
aligntrue init
aligntrue sync
```

AlignTrue will:

1. Create `.aligntrue/config.yaml` (configuration)
2. Create `.aligntrue/.rules.yaml` (internal representation)
3. Keep your `AGENTS.md` as the primary editable source
4. Export to any other agents you enable

### Migrating from Windsurf

**Before** (`.windsurf/rules.md`):

```markdown
# Windsurf Rules

## Code Style

Use consistent formatting:

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
```

**After** (`AGENTS.md`):

```markdown
# Project Rules

## Code Style

Use consistent formatting:

- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
```

Then:

```bash
aligntrue init
aligntrue sync
```

Both Windsurf and other agents will now have your rules.

### Migrating from multiple agents

If you have rules in multiple agent formats, consolidate them into one `AGENTS.md`:

1. **Collect**: Copy all rules from all agents
2. **Merge**: Combine into one `AGENTS.md`, removing duplicates
3. **Organize**: Use clear headings to structure rules
4. **Initialize**: Run `aligntrue init`
5. **Sync**: Run `aligntrue sync`

Example consolidated `AGENTS.md`:

```markdown
# Project Rules

## Development Workflow

(Rules from Cursor)

## Code Quality

(Rules from AGENTS.md)

## Testing Standards

(Rules from Windsurf)
```

## Workflow after migration

### Editing rules

Edit `AGENTS.md` directly, then sync:

```bash
# Edit AGENTS.md with your changes
vim AGENTS.md

# Sync to all agents
aligntrue sync
```

### Adding new agents

Enable additional agents in `.aligntrue/config.yaml`:

```yaml
exporters:
  - cursor
  - agents-md
  - windsurf
  - claude-md
```

Then sync:

```bash
aligntrue sync
```

Your rules will export to all enabled agents.

### Team collaboration

For team projects, commit AlignTrue files:

```bash
git add .aligntrue/ AGENTS.md
git commit -m "Add AlignTrue configuration"
```

Team members run:

```bash
git pull
aligntrue sync
```

Everyone stays in sync.

## Tips for clean migration

### Keep it simple

Don't overthink it. Copy rules as prose, organize with headings:

```markdown
## Rule name

What to do and why.

Example of good practice.
```

### Remove agent-specific syntax

Strip out agent-specific formatting:

- Remove YAML frontmatter (unless you want it)
- Remove special markers or tags
- Keep just the content

### Organize logically

Use clear section headings:

```markdown
# Project Rules

## Development Workflow

(Setup, tooling, environment rules)

## Code Quality

(Style, patterns, best practices)

## Testing

(Test requirements, coverage, standards)
```

### Start small

Migrate your most important rules first:

1. Copy 2-3 critical rules
2. Test the workflow
3. Add the rest gradually

## Troubleshooting

**Rules not showing up after sync?**

- Check `.aligntrue/config.yaml` has correct exporters enabled
- Run `aligntrue check` to validate
- Restart your IDE

**Lost formatting?**

- AlignTrue preserves markdown formatting
- Check your `AGENTS.md` file directly
- Re-run `aligntrue sync`

**Multiple versions of rules?**

- Delete old agent files before first sync
- Or let AlignTrue overwrite them
- Back up if needed: `aligntrue backup create`

## Next steps

- Read the [Natural Markdown Workflow guide](/docs/01-guides/natural-markdown-workflow) for authoring best practices
- Learn about [Sync Behavior](/docs/03-concepts/sync-behavior) for advanced workflows
- Explore [Team Mode](/docs/03-concepts/team-mode) for team collaboration

---

**Questions?** Check the [FAQ](/docs/00-getting-started/03-faq) or [Troubleshooting guide](/docs/05-troubleshooting).
