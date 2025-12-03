---
description: Control git visibility and team approval scope for rules
---

# Rule visibility

Rule visibility has two independent dimensions you can control.

## The two dimensions

| Dimension          | Setting                 | What it controls                                | Values                                                     |
| ------------------ | ----------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **Git visibility** | `gitignore: true/false` | Is the rule committed to your repo?             | `false` (committed) or `true` (gitignored)                 |
| **Approval scope** | `scope: personal/team`  | Does it require team approval? (team mode only) | `team` (requires approval) or `personal` (bypass approval) |

These dimensions are **independent**. A rule can be:

- Gitignored but tracked in lockfile (team-scope, gitignored)
- Personal-scope but still committed to the repo
- Both gitignored and personal-scope (fully private)

## Common scenarios

| Goal                                 | Git visibility    | Approval scope | How                      |
| ------------------------------------ | ----------------- | -------------- | ------------------------ |
| Keep rule private to my machine      | `gitignore: true` | `personal`     | Set both in frontmatter  |
| Bypass team approval for preferences | default           | `personal`     | Set `scope: personal`    |
| Share team rules normally            | default           | default        | No special config needed |

## Setting git visibility

Use `gitignore: true` in rule frontmatter to exclude from git:

```yaml
---
title: My Private Notes
gitignore: true
---
# Content here won't be committed
```

AlignTrue will automatically add matching patterns to `.gitignore`.

## Setting approval scope

Use `scope: personal` in rule frontmatter to bypass team lockfile tracking:

```yaml
---
title: My Preferences
scope: personal
---
# This rule won't trigger lockfile changes
```

Personal-scope rules:

- Are excluded from lockfile generation
- Don't trigger drift detection
- Can change freely without team approval

## Pulling rules from a remote source

To pull rules from a private git repository (e.g., personal rules synced across machines):

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:yourusername/personal-rules.git
    personal: true # Marks as personal-scope and auto-gitignored
```

The `personal: true` flag on a source:

- Marks all rules from that source as personal-scope
- Auto-applies `gitignore: true` to those rules
- SSH URLs (`git@...`) automatically get `gitignore: true`

## Backing up rules to a remote

To push your local rules to a backup repository:

```yaml
# .aligntrue/config.yaml
remote_backup:
  default:
    url: git@github.com:yourusername/rules-backup.git
    branch: main
```

Remote backup:

- Pushes `.aligntrue/rules/` to the configured repository
- Is file-pattern based (use `additional` with `include` for selective backup)
- Is unidirectional (push only, not bidirectional sync)

## Best practices

### Do

- Use `gitignore: true` for rules with sensitive content
- Use `scope: personal` for individual preferences in team mode
- Use `sources` with `personal: true` to sync personal rules across machines

### Don't

- Use `scope: personal` to bypass team review for shared standards
- Assume gitignored rules are backed up (configure `remote_backup` for that)

## Troubleshooting

### Rule still showing in git status after marking gitignore

Run sync again to update `.gitignore`:

```bash
aligntrue sync
git status
```

If still showing, manually remove from git cache:

```bash
git rm --cached .aligntrue/rules/rulename.md
git status  # Should now be gitignored
```

### Personal-scope rules still in lockfile

Make sure `scope: personal` is in the rule's frontmatter:

```yaml
---
title: My Rule
scope: personal
---
```

Then sync and verify:

```bash
aligntrue sync
cat .aligntrue.lock.json | grep rulename  # Should NOT appear
```

## Related

- [Team Mode](/docs/03-concepts/team-mode) - How approval scopes work
- [Managing Sources](/docs/01-guides/07-managing-sources) - Adding remote sources
