---
description: Understand git visibility and approval scope for rules
---

# Rule visibility

Rules can be customized across two independent dimensions to fit different team structures and workflows.

## Two dimensions of rule visibility

### 1. Git visibility

**Controls:** Whether rules are committed to your repository.

```yaml
---
gitignore: false # Default: rule is committed
---
```

| Setting                      | Behavior                             | Use case                                  |
| ---------------------------- | ------------------------------------ | ----------------------------------------- |
| `gitignore: false` (default) | Rule file committed to git           | Team standards, shared guidelines         |
| `gitignore: true`            | Rule file gitignored (not committed) | Sensitive configs, machine-specific notes |

**Note:** Git visibility affects both source files and exported files.

### 2. Approval scope (team mode only)

**Controls:** Whether rules are tracked in the lockfile and require team review.

```yaml
---
scope: team # Default: included in lockfile
---
```

| Setting                 | Behavior                                       | Use case                                 |
| ----------------------- | ---------------------------------------------- | ---------------------------------------- |
| `scope: team` (default) | Rule included in lockfile, tracked for drift   | Team standards, shared guidelines        |
| `scope: personal`       | Rule excluded from lockfile, no drift tracking | Personal preferences, experimental rules |

**Only applies in team mode.** In solo mode, lockfile is disabled by default.

## Common combinations

| Scenario                | Git visibility    | Approval scope    | Result                             |
| ----------------------- | ----------------- | ----------------- | ---------------------------------- |
| **Team standard**       | default           | default           | Committed, tracked in lockfile     |
| **Personal preference** | default           | `scope: personal` | Committed, not in lockfile         |
| **Sensitive config**    | `gitignore: true` | default           | Not committed, tracked in lockfile |
| **Machine-specific**    | `gitignore: true` | `scope: personal` | Not committed, not tracked         |

## Decision matrix

**1. Is this rule sensitive or machine-specific?**

- Yes → Set `gitignore: true`
- No → Leave default (committed)

**2. Are you using team mode and want to bypass lockfile tracking?**

- Yes → Set `scope: personal`
- No → Leave default (tracked)

## How dimensions interact

| Git visibility    | Approval scope    | Result                                       |
| ----------------- | ----------------- | -------------------------------------------- |
| default           | `scope: team`     | Standard team rule: committed, tracked       |
| default           | `scope: personal` | Personal rule: committed, not tracked        |
| `gitignore: true` | `scope: team`     | Gitignored team rule: not committed, tracked |
| `gitignore: true` | `scope: personal` | Fully private: not committed, not tracked    |

## Practical examples

### Example 1: Team security policy

```yaml
---
title: Security Policy
description: Required practices for all team members
---
# Security Policy

- Use strong passwords
- Enable 2FA
- Never commit secrets
```

**Result:** Committed to repo, tracked in lockfile, requires team approval to change.

### Example 2: Personal editor shortcuts

```yaml
---
title: My VS Code Shortcuts
description: Custom keybindings just for me
scope: personal
---
# My Shortcuts

- Cmd+Shift+L: Format document
- Cmd+Shift+U: Convert to uppercase
```

**Result:** Committed to repo, excluded from lockfile, can change freely.

### Example 3: Internal deployment notes (gitignored)

```yaml
---
title: Deployment Notes (Internal)
description: Internal procedures, not for distribution
gitignore: true
---
# Internal Procedures

- SSH into prod-1.internal
- Update deployment key
```

**Result:** Gitignored (not committed), tracked in lockfile.

## Syncing rules across machines

To sync personal rules across your machines, use a git source:

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/personal-rules.git
    personal: true # Auto-gitignored and personal-scope
```

To backup your local rules to a remote:

```yaml
# .aligntrue/config.yaml
remote_backup:
  default:
    url: git@github.com:yourusername/rules-backup.git
```

## Best practices

### Do

- Use `gitignore: true` for anything with internal details or sensitive information
- Use `scope: personal` for individual preferences that don't affect team standards
- Use `sources` with `personal: true` to sync personal rules across machines
- Use `remote_backup` to backup important rules

### Don't

- Use `scope: personal` to bypass team review for shared rules
- Mark security policies as `gitignore: true` without team discussion

## Related

- [Team Mode](/docs/03-concepts/team-mode) - How approval scopes work in team mode
- [Rule Visibility Guide](/docs/01-guides/09-rule-visibility) - Step-by-step workflows
- [Managing Sources](/docs/01-guides/07-managing-sources) - Adding remote sources
