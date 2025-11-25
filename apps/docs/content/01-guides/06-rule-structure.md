---
title: Choosing a rule structure
description: Select the right rule organization strategy for your project size and team
---

# Choosing your organization structure

AlignTrue supports multiple ways to organize your rules, from a single file for simple projects to complex hierarchical structures for large monorepos. This guide helps you choose the right approach.

## Quick decision guide

| Project size   | Team size       | Rules count  | Recommended structure                                 |
| -------------- | --------------- | ------------ | ----------------------------------------------------- |
| Small          | 1 developer     | < 20 rules   | [Simple (single file)](#simple-projects)              |
| Medium         | 2-10 developers | 20-100 rules | [Organized (multi-file)](#organized-projects)         |
| Large monorepo | 10+ developers  | 100+ rules   | [Complex (scoped + hierarchical)](#complex-monorepos) |

## Simple projects

**Best for:** Solo developers, small projects, getting started

### Structure

```
project/
├── .aligntrue/
│   └── config.yaml
└── AGENTS.md  ← Single source file
```

### Configuration

```yaml
exporters:
  - cursor
  - agents
```

That's it! AlignTrue defaults to using `AGENTS.md` as the source file.

### When to use

- You're just getting started with AlignTrue
- Your project has fewer than 20 rules
- You work alone or with 1-2 collaborators
- You want the simplest possible setup

### Example workflow

```bash
# Initialize
aligntrue init

# Edit rules
vim AGENTS.md

# Sync to all agents
aligntrue sync
```

### Pros and cons

**Pros:**

- Simplest setup (zero configuration)
- Easy to navigate (one file to edit)
- Fast sync times
- Works great for small projects

**Cons:**

- Can become unwieldy with many rules
- Higher risk of merge conflicts with multiple editors
- No logical grouping of rules

---

## Organized projects

**Best for:** Teams, projects with many rules, clear ownership needs

### Structure

The structure depends on your agent setup:

**For multiple agents (recommended):**

```
project/
├── .aligntrue/
│   ├── config.yaml
│   └── rules/  ← Neutral source location
│       ├── architecture.md
│       ├── security.md
│       └── testing.md
├── AGENTS.md  ← Generated (merged from sources)
└── .cursor/
    └── rules/  ← Generated (merged or split based on config)
```

**For single agent (Cursor only):**

```
project/
├── .aligntrue/
│   └── config.yaml
└── .cursor/
    └── rules/  ← Native multi-file format
        ├── architecture.mdc
        ├── security.mdc
        └── testing.mdc
```

### Configuration

**Multiple agents:**

```yaml
exporters:
  - cursor
  - agents
```

Rules are stored in `.aligntrue/rules/` by default and synced to all agents.

**Single agent (Cursor only):**

```yaml
exporters:
  - cursor
```

Rules are stored in `.aligntrue/rules/` and synced to Cursor.

### Creating the structure

**Option 1: Split existing AGENTS.md**

```bash
# Interactive split (asks for target directory)
aligntrue sources split

# Non-interactive (uses .aligntrue/rules/ by default)
aligntrue sources split --yes
```

**Option 2: Create files manually**

```bash
# Create directory
mkdir -p .aligntrue/rules

# Create rule files
echo "# Architecture Guidelines" > .aligntrue/rules/architecture.md
echo "# Security Best Practices" > .aligntrue/rules/security.md
echo "# Testing Standards" > .aligntrue/rules/testing.md
```

### When to use

- Your rule file exceeds 1000 lines
- Multiple team members edit rules
- You want clear ownership (via CODEOWNERS)
- You experience frequent merge conflicts
- You want logical grouping of rules

### Where to organize files

**Choose based on your setup:**

- **Single agent (Cursor only)**: Use `.cursor/rules/*.mdc` (native format)
- **Multiple agents**: Use `.aligntrue/rules/*.md` (neutral source)
- **Team mode**: Use `.aligntrue/rules/*.md` (goes through PR review)

AlignTrue automatically adapts exports:

- **Multi-file agents** (Cursor, Amazon Q, etc.): Preserves your file organization
- **Single-file agents** (AGENTS.md, Claude, etc.): Merges files automatically

See [Multi-file organization](/docs/02-customization/multi-file-organization) for details.

### Rule file organization

AlignTrue automatically loads all `*.md` files from `.aligntrue/rules/` directory:

```yaml
# Default: all files in .aligntrue/rules/
.aligntrue/
├── rules/
│   ├── architecture.md
│   ├── security.md
│   ├── testing.md
│   └── subdir/
│       └── advanced.md
```

Files are loaded in alphabetical order. Subdirectories are also supported for further organization.

### Example workflow

```bash
# Edit specific rule category
vim rules/security.md

# Sync merges all source files
aligntrue sync

# View source files
aligntrue sources list
```

### Pros and cons

**Pros:**

- Logical organization by concern
- Reduced merge conflicts
- Clear ownership via CODEOWNERS
- Easier to find and update specific rules
- Better for code review (smaller diffs)

**Cons:**

- Requires configuration
- Slightly more complex than single file
- Need to decide on file organization strategy

---

## Complex monorepos

**Best for:** Large teams, monorepos, projects with distinct components

### Structure

```
monorepo/
├── .aligntrue/
│   └── config.yaml
├── rules/
│   ├── global.md
│   ├── frontend.md
│   └── backend.md
├── apps/
│   └── web/
│       ├── AGENTS.md  ← Includes root + apps + web rules
│       └── .cursor/
│           └── rules/
│               └── web.mdc
├── services/
│   └── api/
│       ├── AGENTS.md  ← Includes root + services + api rules
│       └── .cursor/
│           └── rules/
│               └── api.mdc
└── AGENTS.md  ← Root rules only
```

### Configuration

```yaml
exporters:
  - cursor
  - agents

sync:
  source_files: "rules/*.md"
  source_order:
    - global.md
    - frontend.md
    - backend.md

scopes:
  - path: "apps/web"
    inherit: true # Include parent rules (default)
  - path: "services/api"
    inherit: true
  - path: "packages/isolated"
    inherit: false # Isolated: no parent rules
```

### How it works

**Hierarchical inheritance:**

When `inherit: true` (default), child scopes include rules from all parent scopes:

- `apps/web/AGENTS.md` contains:
  1. Root rules (from `.`)
  2. `apps` rules (if defined)
  3. `apps/web` rules

- `services/api/AGENTS.md` contains:
  1. Root rules (from `.`)
  2. `services` rules (if defined)
  3. `services/api` rules

**Breaking inheritance:**

Set `inherit: false` to create isolated scopes:

```yaml
scopes:
  - path: "packages/isolated"
    inherit: false # Only includes packages/isolated rules
```

### Nested agent files

All exporters support nested directories:

- **AGENTS.md**: `apps/web/AGENTS.md`, `services/api/AGENTS.md`
- **CLAUDE.md**: `apps/web/CLAUDE.md`, `services/api/CLAUDE.md`
- **Cursor**: `apps/web/.cursor/rules/web.mdc`, `services/api/.cursor/rules/api.mdc`

### When to use

- Monorepo with multiple apps/services
- Different teams own different parts
- Need context-specific rules (frontend vs backend)
- Want to share common rules across scopes
- 100+ rules total

### Example workflow

```bash
# Sync creates nested files automatically
aligntrue sync

# Check which rules apply to a scope
cd apps/web
aligntrue sources list

# Edit scope-specific rules
vim rules/frontend.md
aligntrue sync
```

### Pros and cons

**Pros:**

- Perfect for monorepos
- Context-specific rules per component
- Shared rules via inheritance
- Clear boundaries between components
- Scales to very large projects

**Cons:**

- Most complex setup
- Requires understanding of scopes and inheritance
- More files to manage
- Longer sync times (processes multiple scopes)

---

## Migration paths

### Simple → Organized

When your single `AGENTS.md` file becomes too large:

```bash
# Create rules directory
mkdir rules

# Split AGENTS.md into multiple files
aligntrue sources split

# Update config
cat >> .aligntrue/config.yaml << EOF
sync:
  source_files: "rules/*.md"
EOF

# Sync
aligntrue sync
```

### Organized → Complex

When you need scope-specific rules:

```bash
# Add scopes to config
cat >> .aligntrue/config.yaml << EOF
scopes:
  - path: "apps/web"
  - path: "services/api"
EOF

# Sync creates nested files
aligntrue sync
```

---

## Best practices

### File naming

- Use lowercase with hyphens: `coding-standards.md`
- Be descriptive: `api-design-guidelines.md` not `api.md`
- Group related rules: `security-authentication.md`, `security-encryption.md`

### Organization strategies

**By concern** (recommended for most projects):

```
rules/
├── architecture.md
├── security.md
├── testing.md
└── documentation.md
```

**By technology**:

```
rules/
├── typescript.md
├── react.md
├── nodejs.md
└── postgres.md
```

**By team**:

```
rules/
├── frontend-team.md
├── backend-team.md
└── devops-team.md
```

### Scope design

**Align with repository structure:**

```yaml
scopes:
  - path: "apps/web"
  - path: "apps/mobile"
  - path: "services/api"
  - path: "packages/shared"
```

**Use inheritance strategically:**

```yaml
scopes:
  # Shared rules for all apps
  - path: "apps"
    inherit: true # Includes root rules

  # Specific apps inherit from "apps"
  - path: "apps/web"
    inherit: true
  - path: "apps/mobile"
    inherit: true

  # Isolated package (no inheritance)
  - path: "packages/third-party"
    inherit: false
```

---

## Troubleshooting

### "Too many source files"

If you have 10+ source files, consider:

- Consolidating related rules
- Using subdirectories with recursive glob: `rules/**/*.md`
- Reviewing if all files are necessary

### "Merge conflicts in AGENTS.md"

This means you're using simple structure with multiple editors:

- Migrate to organized structure with `aligntrue sources split`
- Use CODEOWNERS to assign file ownership

### "Nested AGENTS.md missing parent rules"

Check scope configuration:

```yaml
scopes:
  - path: "apps/web"
    inherit: true # Must be true (or omitted, as it's default)
```

### "Rules applying to wrong scope"

Sections include `vendor.aligntrue.source_scope` metadata. Check with:

```bash
cat .aligntrue/rules | grep source_scope
```

---

## Related documentation

- [Multi-file organization](/docs/02-customization/multi-file-organization) - Detailed guide on source files
- [Scopes](/docs/02-customization/scopes) - Advanced scope configuration
- [Solo vs team mode](/docs/00-getting-started/02-solo-vs-team-mode) - Choosing your mode
- [Solo developer guide](/docs/01-guides/02-solo-developer-guide) - Workflows for solo devs
- [Team guide](/docs/01-guides/04-team-guide) - Workflows for teams

---

## Summary

Choose your structure based on project size and team:

- **Simple (single file)**: Solo developers, < 20 rules, getting started
- **Organized (multi-file)**: Teams, 20-100 rules, need clear ownership
- **Complex (scoped)**: Monorepos, 100+ rules, context-specific needs

Start simple and migrate as your needs grow. AlignTrue makes it easy to evolve your structure over time.
