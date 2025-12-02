# Rule Privacy

Keep sensitive rules out of version control while still using them with AI agents.

## Overview

AlignTrue supports **private rules** - rules that are used locally but not committed to git. This is useful for:

- **Personal preferences** that shouldn't be shared with the team
- **Proprietary guidelines** from a private repository
- **Sensitive configurations** that contain internal details

## How It Works

### Automatic Detection (SSH Sources)

When you add rules from an SSH URL (which requires authentication), AlignTrue automatically treats them as private:

```bash
# SSH URL detected as private source
aligntrue add git@github.com:user/private-rules
```

Output:

```
◇  Private source detected (SSH authentication)
│  Rules added to .gitignore automatically.
│
◆  Created 3 files in .aligntrue/rules/
│
◇  Synced to agents
│
◆  Tips:
│    • To commit these rules: remove from .gitignore
│    • To remove: delete the files and run 'aligntrue sync'
```

### Source-Level Privacy

Mark an entire source as private in your config:

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:user/private-rules
    private: true # All rules from this source are private
```

### Per-Rule Privacy

Override source-level settings in individual rule frontmatter:

```yaml
---
# Force a rule to be private, regardless of source settings
private: true
---
# My Private Rule

This rule will be gitignored even if it comes from a public source.
```

Or make a specific rule public from a private source:

```yaml
---
# Make public even though source is private
private: false
---
# This Rule Can Be Shared

This rule will be committed even though the source is private.
```

## What Gets Gitignored

When a rule is marked as private, AlignTrue automatically adds to `.gitignore`:

1. **Source file**: `.aligntrue/rules/rulename.md`
2. **Exported files**: All agent-specific exports like:
   - `.cursor/rules/rulename.mdc`
   - Sections in `AGENTS.md`, `CLAUDE.md`, etc.

The gitignore entries are managed in a dedicated section:

```gitignore
# START AlignTrue Private Rules
# Source: git@github.com:user/private-rules (private: true)
.aligntrue/rules/private-rule.md
.cursor/rules/private-rule.mdc
# END AlignTrue Private Rules
```

## Privacy Resolution Order

When determining if a rule is private:

1. Check rule frontmatter for explicit `private: true/false`
2. If not set, check source-level `private` setting
3. If still not set, rule is **not private** (follows `git.mode`)

## Relationship with git.mode

The `private` flag works alongside `git.mode`:

| Setting               | Scope        | What it controls                           |
| --------------------- | ------------ | ------------------------------------------ |
| `git.mode`            | Project-wide | Default for all non-private exported files |
| `source.private`      | Per-source   | All rules from that source                 |
| `frontmatter.private` | Per-rule     | Override for specific rules                |

Example:

- `git.mode: commit` (enterprise default)
- Source A: `private: false` → rules committed
- Source B: `private: true` → rules gitignored
- Rule with `private: true` frontmatter → gitignored regardless of source

## Best Practices

### Organize Private Rules

Keep private rules in their own source for easier management:

```yaml
sources:
  - type: local
    path: .aligntrue/rules # Team shared rules
  - type: git
    url: git@github.com:user/personal-rules
    private: true # Personal rules
```

### Review Before Committing

After adding new rules, check your git status:

```bash
git status
# Should NOT show private rule files
```

### Team Coordination

For team projects with mixed public/private rules:

1. Keep shared rules in `.aligntrue/rules/` (committed)
2. Import personal rules from a private source with `private: true`
3. Each team member can have their own private rules

## Removing Private Rules

To make a private rule public:

1. Remove `private: true` from frontmatter (or set `private: false`)
2. Remove source-level `private: true` if applicable
3. Run `aligntrue sync`
4. Remove the file from `.gitignore` (AlignTrue won't auto-remove it)
5. Commit the rule files

## Related

- [Git Sources](/docs/04-reference/git-sources) - Import rules from git repositories
- [Managing Sources](/docs/01-guides/08-managing-sources) - Add, remove, and update rule sources
- [Git Workflows](/docs/03-concepts/git-workflows) - How AlignTrue integrates with git
