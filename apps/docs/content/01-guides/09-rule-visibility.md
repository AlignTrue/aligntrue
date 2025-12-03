---
description: Control git visibility, team approval, and remote routing for rules
---

# Rule visibility

Rule visibility has three dimensions you can control.

## The three dimensions

| Dimension          | Setting                       | What it controls                                | Values                                                                                                |
| ------------------ | ----------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Git visibility** | `gitignore: true/false`       | Is the rule committed to your repo?             | `false` (committed) or `true` (gitignored)                                                            |
| **Approval scope** | `scope: team/personal/shared` | Does it require team approval? (team mode only) | `team` (requires approval), `personal` (bypass approval), `shared` (tracked, routed to shared remote) |
| **Remote routing** | `remotes` config              | Where is the rule synced?                       | Personal remote, shared remote, or custom remotes                                                     |

These dimensions are **largely independent**. A rule can be:

- Gitignored but tracked in lockfile (team-scope, gitignored)
- Personal-scope but still committed to the repo
- Both gitignored and personal-scope (fully private)
- Shared-scope for publishing to others

## Common scenarios

| Goal                                 | Git visibility    | Approval scope | Remote routing  | How                      |
| ------------------------------------ | ----------------- | -------------- | --------------- | ------------------------ |
| Keep rule private to my machine      | `gitignore: true` | `personal`     | Personal remote | Set both in frontmatter  |
| Bypass team approval for preferences | default           | `personal`     | Personal remote | Set `scope: personal`    |
| Share team rules normally            | default           | default        | Main repo only  | No special config needed |
| Publish rules for others to use      | default           | `shared`       | Shared remote   | Set `scope: shared`      |

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

Use `scope` in rule frontmatter to control lockfile tracking and remote routing:

```yaml
---
title: My Preferences
scope: personal
---
# This rule won't trigger lockfile changes and routes to personal remote
```

### Scope values

| Scope            | Lockfile | Remote routing               | Use case                   |
| ---------------- | -------- | ---------------------------- | -------------------------- |
| `team` (default) | Tracked  | Stays in main repo           | Shared team standards      |
| `personal`       | Excluded | Routes to `remotes.personal` | Individual preferences     |
| `shared`         | Tracked  | Routes to `remotes.shared`   | Published rules for others |

Personal-scope rules:

- Are excluded from lockfile generation
- Don't trigger drift detection
- Can change freely without team approval
- Are automatically synced to your personal remote (if configured)

Shared-scope rules:

- Are tracked in lockfile (require team approval)
- Are synced to your shared remote (for publishing)

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

## Syncing rules to remote repositories

Use `remotes` config to sync rules based on their scope:

```yaml
# .aligntrue/config.yaml
remotes:
  # Personal-scope rules go here
  personal: git@github.com:yourusername/personal-rules.git

  # Shared-scope rules go here (for publishing)
  shared: git@github.com:yourusername/shared-rules.git
```

### How routing works

1. **Scope-based routing** (primary): Rules are routed based on their `scope` frontmatter
   - `scope: personal` rules → `remotes.personal`
   - `scope: shared` rules → `remotes.shared`
   - `scope: team` rules → stay in main repo only

2. **Custom pattern routing** (additive): Use `custom` for fine-grained control
   ```yaml
   remotes:
     personal: git@github.com:me/personal.git
     custom:
       - id: typescript-rules
         url: git@github.com:me/typescript-pack.git
         include: ["typescript*.md", "eslint*.md"]
   ```

Custom remotes are **additive** - files can go to multiple destinations. A rule with `scope: personal` will go to the personal remote AND any matching custom remotes.

## Best practices

### Do

- Use `gitignore: true` for rules with sensitive content
- Use `scope: personal` for individual preferences in team mode
- Use `scope: shared` for rules you want to publish to others
- Use `sources` with `personal: true` to pull personal rules from remote
- Configure `remotes.personal` to sync personal rules across machines

### Don't

- Use `scope: personal` to bypass team review for shared standards
- Assume gitignored rules are backed up (configure `remotes.personal` for that)
- Configure the same URL as both a source and a remote (creates conflicts)

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
