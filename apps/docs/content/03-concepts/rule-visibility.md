---
description: Understand git visibility, approval scope, and storage location for rules
---

# Rule visibility

Rules can be customized across three independent dimensions to fit different team structures and workflows. Understanding these dimensions helps you choose the right approach for your rules.

## Three dimensions of rule visibility

### 1. Git visibility

**Controls:** Whether rules are committed to your repository.

```yaml
---
private: false # Default: rule is committed
---
```

| Setting                    | Behavior                             | Use case                                                    |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `private: false` (default) | Rule file committed to git           | Team standards, shared guidelines                           |
| `private: true`            | Rule file gitignored (not committed) | Sensitive configs, internal details, machine-specific notes |

**Note:** Git visibility only affects the **source rule file** (e.g., `.aligntrue/rules/my-rule.md`). Exported files (`.cursor/rules/*.mdc`, etc.) follow the same visibility setting.

### 2. Approval scope (team mode only)

**Controls:** Whether rules require team review and approval.

```yaml
---
scope: team # Default: requires team approval to change
---
```

| Setting                 | Behavior                                     | Use case                                                  |
| ----------------------- | -------------------------------------------- | --------------------------------------------------------- |
| `scope: team` (default) | Rule included in lockfile, requires approval | Team standards, security policies, shared guidelines      |
| `scope: personal`       | Rule excluded from lockfile, no team review  | Personal shortcuts, local preferences, experimental rules |

**Only applies in team mode.** In solo mode, all rules use your local storage and don't require approval.

### 3. Storage location

**Controls:** Where rules are physically stored.

```yaml
storage:
  team:
    type: repo # Team rules in main repo
  personal:
    type: remote # Personal rules in separate repo
```

| Location   | Format                                | Behavior                            | Use case                                         |
| ---------- | ------------------------------------- | ----------------------------------- | ------------------------------------------------ |
| **repo**   | `.aligntrue/rules/` in main repo      | Committed with project              | Team standards, shared rules                     |
| **local**  | `.aligntrue/.local/personal/rules.md` | Machine-only, gitignored            | Personal rules, machine-specific configs         |
| **remote** | `git@github.com:you/rules.git`        | Version controlled in separate repo | Personal rules with backup, sync across machines |

## Common combinations

Choose based on your needs:

| Scenario                | Git visibility   | Approval scope    | Storage             | Why                                            |
| ----------------------- | ---------------- | ----------------- | ------------------- | ---------------------------------------------- |
| **Team standard**       | `private: false` | `scope: team`     | `repo`              | Everyone sees it, requires approval, committed |
| **Personal preference** | `private: false` | `scope: personal` | `local` or `remote` | Only you use it, no approval needed            |
| **Sensitive config**    | `private: true`  | `scope: team`     | `remote`            | Team uses it, gitignored, version controlled   |
| **Machine-specific**    | `private: false` | `scope: personal` | `local`             | Only your machine, not backed up               |

## Decision matrix

Use this to choose the right combination for your rules:

**1. Is this rule sensitive or machine-specific?**

- Yes → Set `private: true`
- No → Set `private: false` (or omit, default is false)

**2. Are you using team mode and want to bypass approval?**

- Yes → Set `scope: personal`
- No → Set `scope: team` (or omit, default is team)

**3. Do you need this rule on multiple machines?**

- Yes, with backup → Set `storage.personal.type: remote`
- Yes, without backup → Set `storage.personal.type: local`
- No → Use `storage.team.type: repo`

## How dimensions interact

### Git visibility + Approval scope

| Git visibility   | Approval scope    | Result                                           |
| ---------------- | ----------------- | ------------------------------------------------ |
| `private: false` | `scope: team`     | Standard team rule: committed, requires approval |
| `private: false` | `scope: personal` | Personal rule in repo: committed, no approval    |
| `private: true`  | `scope: team`     | Gitignored team rule: private, requires approval |
| `private: true`  | `scope: personal` | Gitignored personal rule: private, no approval   |

### Approval scope + Storage location (team mode)

| Approval scope    | Storage                         | Sync behavior                   |
| ----------------- | ------------------------------- | ------------------------------- |
| `scope: team`     | `storage.team.type: repo`       | Team members sync via lockfile  |
| `scope: personal` | `storage.personal.type: local`  | Only your machine               |
| `scope: personal` | `storage.personal.type: remote` | Your machines via personal repo |

## Practical examples

### Example 1: Team security policy

```yaml
---
title: Security Policy
description: Required practices for all team members
private: false
scope: team
---
# Security Policy

- Use strong passwords
- Enable 2FA
- Never commit secrets
```

**Result:** Committed to repo, requires team approval, validated in lockfile.

### Example 2: Personal editor shortcuts

```yaml
---
title: My VS Code Shortcuts
description: Custom keybindings just for me
private: false
scope: personal
---
# My Shortcuts

- Cmd+Shift+L: Format document
- Cmd+Shift+U: Convert to uppercase
```

**Config:**

```yaml
storage:
  personal:
    type: local
```

**Result:** In your rules, no approval needed, stored locally on your machine.

### Example 3: Internal deployment notes (gitignored)

```yaml
---
title: Deployment Notes (Internal)
description: Internal procedures, not for distribution
private: true
scope: team
---
# Internal Procedures

- SSH into prod-1.internal
- Update deployment key
```

**Result:** Gitignored, requires team approval to change, stored in private remote.

### Example 4: Experimental rules with remote backup

```yaml
---
title: Experimental Workflow
description: Testing new patterns
private: true
scope: personal
---
# Experimental

Testing new git workflow...
```

**Config:**

```yaml
storage:
  personal:
    type: remote
    url: git@github.com:you/experimental-rules.git
```

**Result:** Gitignored, no approval, synced to personal remote repo for backup.

## Migration paths

You can change any dimension at any time:

### Moving from local to remote storage

```bash
# 1. Update config
# storage.personal.type: local → storage.personal.type: remote

# 2. Run sync to initialize remote
aligntrue sync

# Rules now backed up in remote repo
```

### Making a personal rule public

```yaml
# Before
---
scope: personal
---
# After
---
scope: team
---
# Then run:
# aligntrue sync
```

Rules move from excluded (not validated) to included in lockfile validation.

### Adding git visibility to a rule

```yaml
# Before (committed)
---
scope: personal
---
# After (gitignored)
---
private: true
scope: personal
---
# Then run:
# aligntrue sync
# git status  # See the file now gitignored
```

## Best practices

### Do

- Use `private: true` for anything with internal details, credentials, or sensitive information
- Use `scope: personal` for individual preferences that don't affect team standards
- Organize personal rules in a separate remote repo for easier management
- Review your `.gitignore` after changing visibility settings to confirm expectations

### Don't

- Use `scope: personal` to bypass team review for shared rules (defeats the purpose of team mode)
- Mark security policies or team standards as `private: true` without team discussion
- Use `storage.personal.type: local` if you need to sync across machines (use `remote` instead)
- Assume other team members can see personal-scope rules (they can't, unless they configure the same remote)

## Related

- [Team Mode](/docs/03-concepts/team-mode) - How approval scopes work in team mode
- [Git Workflows](/docs/03-concepts/git-workflows) - Committing and syncing rules
- [Rule Privacy Guide](/docs/01-guides/09-rule-visibility) - Step-by-step workflows
- [Personal Repository Setup](/docs/04-reference/personal-repo-setup) - Setting up remote storage
