---
description: Practical workflows for git visibility, approval scope, and storage location
---

# Rule visibility

Rule visibility has three independent dimensions you can combine to fit your workflow.

## The three dimensions

| Dimension            | Setting                 | What it controls                                | Values                                                                   |
| -------------------- | ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Git visibility**   | `private: true/false`   | Is the rule committed to your main repo?        | `false` (committed) or `true` (gitignored)                               |
| **Approval scope**   | `scope: personal/team`  | Does it require team approval? (team mode only) | `team` (requires approval) or `personal` (bypass approval)               |
| **Storage location** | `storage.personal.type` | Where do personal-scope rules live?             | `repo` (main repo), `local` (machine-only), `remote` (separate git repo) |

These dimensions are **independent**. A rule can be:

- Gitignored from the main repo but version-controlled in a personal remote
- Personal-scope (bypass approval) but still committed to the main repo
- Team-scope (requires approval) but stored in a private team remote

## Common scenarios

Choose based on what you want to achieve:

| Goal                                        | Git visibility | Approval scope | Storage       | Example                                          |
| ------------------------------------------- | -------------- | -------------- | ------------- | ------------------------------------------------ |
| Keep a rule only on my machine              | `false`        | `personal`     | `local`       | Personal editor settings, machine-specific notes |
| Sync personal rules across my machines      | `false`        | `personal`     | `remote`      | Personal shortcuts, cross-machine preferences    |
| Keep sensitive content out of the main repo | `true`         | `team`         | `remote`      | Internal deployment guides, credentials          |
| Bypass team approval for my preferences     | `false`        | `personal`     | `repo`        | Personal workflow tweaks in team repo            |
| Share sensitive rules privately with team   | `true`         | `team`         | (from source) | Private company guidelines in private git repo   |

## Workflow: Keep a rule only on your machine

Use this when you have personal preferences that should never be committed and stay on only this machine.

### Step 1: Create a personal-scope rule

```yaml
---
title: My Editor Settings
description: Personal preferences, not for team
scope: personal
---
# Custom Keybindings

- Cmd+Shift+L: Format document
- Cmd+K Cmd+0: Fold all regions
```

### Step 2: Configure local storage (default)

In team mode, configure personal rules to stay local:

```yaml
# .aligntrue/config.yaml
mode: team

storage:
  team:
    type: repo
  personal:
    type: local # Machine-only, gitignored
```

In solo mode, local is the default.

### Step 3: Sync and verify

```bash
aligntrue sync
git status

# Good: rules file NOT shown
# Personal rules are in .aligntrue/.local/personal/rules.md (gitignored)
```

## Workflow: Sync personal rules across your machines

Use this when you want personal rules backed up and synced across multiple machines, but not in your team's main repository.

### Step 1: Create a personal remote repository

Create a private git repository (e.g., `git@github.com:yourusername/personal-rules.git`).

For detailed SSH setup, see [Personal Repository Setup](/docs/04-reference/personal-repo-setup).

### Step 2: Configure remote storage

```yaml
# .aligntrue/config.yaml
mode: team

storage:
  team:
    type: repo
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git
    branch: main
```

### Step 3: Create personal-scope rules

```yaml
---
title: My Workflow Preferences
description: Personal customizations, synced to remote
scope: personal
---
# Custom Commands

- My linting standards
- Editor shortcuts
- Development tools
```

### Step 4: Sync to initialize remote

```bash
aligntrue sync
```

AlignTrue will:

- Clone your personal remote to `.aligntrue/.remotes/personal/`
- Write personal-scope rules to that repository
- Commit and push

### Step 5: Sync from other machines

On another machine with the same personal remote configured:

```bash
aligntrue sync
# Personal rules pulled from remote
```

Personal rules now sync across machines. Each machine stays in sync via the remote.

## Workflow: Keep sensitive content out of the main repository

Use this when you have rules with internal details, credentials, or sensitive information that shouldn't be committed to your main repository—but you want them version-controlled and shared with your team.

### Step 1: Create a private source

Create a private git repository to hold the sensitive rules (e.g., `git@github.com:company/internal-rules.git`).

### Step 2: Add as source (all team members)

Each team member adds it to their config:

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules # Team shared rules
  - type: git
    url: git@github.com:company/internal-rules.git
    private: true # SSH automatically detected as private
```

### Step 3: Rules stay gitignored locally

```bash
aligntrue sync
git status

# Good: Internal rules NOT shown
# They are in .aligntrue/.remotes/internal-rules/ (gitignored)
# But fetched from the private remote and used locally
```

Result: Rules are version-controlled in a private repo, accessible locally, but never committed to your main repository.

## Workflow: Bypass team approval for your preferences

Use this when you have individual customizations in team mode that shouldn't require approval.

### Step 1: Mark rule as personal-scope

```yaml
---
title: My Personal Shortcuts
description: Individual preferences, bypass team approval
scope: personal
---
# Custom Commands

- Cmd+Shift+L: Format document
- Cmd+Shift+U: Convert to uppercase
```

### Step 2: Choose storage

Local (machine-only):

```yaml
storage:
  personal:
    type: local
```

Or remote (synced):

```yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git
```

### Step 3: Sync and commit only team rules

```bash
aligntrue sync

# Lockfile changed? Only for team-scope rules
git add .aligntrue.lock.json
git commit -m "chore: Update team rules"

# Personal rules are excluded from lockfile
# Commit will not change even if personal rules change
```

Personal-scope rules are not validated against the lockfile, so changes don't trigger team review.

## Workflow: Share sensitive rules privately with team

Use this when your team needs to share sensitive rules (e.g., internal guidelines, deployment procedures) but you want them out of the main repository.

### Step 1: Create shared private source

```bash
# Create private repo: git@github.com:company/team-guidelines.git
git clone git@github.com:company/team-guidelines.git
cd team-guidelines

# Add your sensitive team rules
echo "# Internal Guidelines" >> rules.md
git add rules.md
git commit -m "Add team guidelines"
git push
```

### Step 2: Each team member adds source

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules # Public team rules
  - type: git
    url: git@github.com:company/team-guidelines.git
    private: true # Private source, stays gitignored
```

### Step 3: Sync and verify

```bash
aligntrue sync
git status

# Good: Private rules NOT shown
# They are fetched but gitignored locally
```

All team members access the same sensitive guidelines without committing them to the main repository.

## Combining dimensions

You can mix dimensions in many ways. Here are some advanced patterns.

### Personal content in your branch (not shared)

```yaml
---
title: Experimental Workflow
description: Testing new patterns, not for team
private: true # Don't commit
scope: personal # Don't require approval
---
# Trying new git strategy...
```

```yaml
storage:
  personal:
    type: local # Only this machine
```

Result: Fully isolated experiment—nothing committed, no approval required, only on your machine.

### Team content from private source (shared, but not in main repo)

```yaml
sources:
  - type: local
    path: .aligntrue/rules # Public team rules
  - type: git
    url: git@github.com:company/security-policies.git
    private: true # Private team source
```

```yaml
---
title: Security Policies
description: Team standards from private source
private: true # From private source (auto-inherited)
scope: team # Requires team approval to change
---
# Security requirements...
```

Result: Team rules version-controlled privately, validated in lockfile, accessible to all team members but not in the main repository.

## Changing dimensions

You can change any dimension at any time.

### Making a gitignored rule public

```yaml
# Before
---
private: true
---
# After
---
private: false # or omit, false is default
---
```

```bash
aligntrue sync
git status  # File is no longer gitignored
git add .aligntrue/rules/rulename.md
git commit -m "Make rule public"
```

### Changing approval scope

```yaml
# Before (team rule, requires approval)
---
scope: team
---
# After (personal rule, bypass approval)
---
scope: personal
---
```

```bash
aligntrue sync
# Rule now excluded from lockfile validation
git add .aligntrue.lock.json
git commit -m "Make rule personal"
```

### Migrating personal rules to remote storage

Current setup (local-only):

```yaml
storage:
  personal:
    type: local
```

New setup (synced):

```yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git
```

Then sync:

```bash
aligntrue sync
# Personal rules now synced to remote repository
```

## Best practices

### Do

- Use `private: true` for internal documentation, sensitive configs, or anything with credentials
- Use `scope: personal` for individual workflow preferences that don't affect team standards
- Keep personal rules in a separate remote repository for easier management and backup
- Review your `.gitignore` after changing visibility to confirm expectations
- Use precise language: say "`private: true`" not "private rules" (ambiguous)
- Store team-shared sensitive rules in a private source, not `private: true` in the main repo

### Don't

- Use `scope: personal` to bypass team review for shared standards (defeats the purpose of team mode)
- Mark team security policies as `private: true` without team discussion
- Use `storage.personal.type: local` if you need to sync multiple machines (use `remote` instead)
- Assume other team members see personal-scope rules (they won't, unless they configure the same remote)
- Treat "version controlled in a private remote" the same as "committed to main repo"

## Troubleshooting

### Rule still showing in git status after marking private

Run sync again to update `.gitignore`:

```bash
aligntrue sync
git status
```

If still showing, manually remove:

```bash
git rm --cached .aligntrue/rules/rulename.md
git status  # Should now be gitignored
```

### Personal-scope rules still requiring approval

Make sure you're in team mode AND set `scope: personal`:

```yaml
# .aligntrue/config.yaml
mode: team # Must be team mode

# In rule:
---
scope: personal # Must be set explicitly
---
```

Then verify in lockfile:

```bash
aligntrue sync
cat .aligntrue.lock.json | grep rulename  # Should NOT appear
```

### Can't sync personal rules to remote

Check SSH access:

```bash
ssh -T git@github.com
# Should show: Hi username! You've successfully authenticated...
```

Verify repository exists and you have write access:

```bash
git clone git@github.com:yourusername/personal-rules.git /tmp/test
```

### Sensitive rules accidentally committed

If you accidentally committed a rule that should be `private: true`:

```bash
# 1. Mark as private
# Edit rule, set private: true
# Sync
aligntrue sync

# 2. Remove from git history (careful!)
git rm --cached .aligntrue/rules/rulename.md
git commit -m "Remove accidental commit"

# 3. Force push if needed (risky!)
git push --force
```

### Personal rules not appearing on another machine

Make sure both machines have the same remote configured:

```yaml
# Machine A and B: .aligntrue/config.yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git # Exact same URL
```

Then sync:

```bash
aligntrue sync
```

## Related

- [Rule Visibility Concepts](/docs/03-concepts/rule-visibility) - Understanding the three dimensions
- [Team Mode](/docs/03-concepts/team-mode) - How approval scopes work in team mode
- [Personal Repository Setup](/docs/04-reference/personal-repo-setup) - Detailed setup for remote personal rules
- [Git Workflows](/docs/03-concepts/git-workflows) - General git integration
- [Managing Sources](/docs/01-guides/07-managing-sources) - Adding and removing rule sources
