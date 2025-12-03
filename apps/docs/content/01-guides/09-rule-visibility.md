---
description: Practical workflows for git visibility, approval scope, and storage location
---

# Rule visibility

Keep rules private, customize workflows per-team member, and sync across machines. This guide covers practical workflows for the three dimensions of rule visibility.

For conceptual background, see [Rule Visibility Concepts](/docs/03-concepts/rule-visibility).

## Quick reference

### I want to keep a rule out of version control

Set `private: true` in the rule frontmatter:

```yaml
---
private: true
---
# Internal Documentation

Sensitive content that should not be committed.
```

Then run `aligntrue sync`. The rule and its exports will be gitignored.

### I want personal rules that don't require team approval

Set `scope: personal` in the rule frontmatter (team mode only):

```yaml
---
scope: personal
---
# My Personal Shortcuts

Cmd+Shift+L: Format document
```

Then run `aligntrue sync`. The rule won't require team approval or be validated in the lockfile.

### I want personal rules backed up to a remote repository

Configure personal storage as remote:

```yaml
# .aligntrue/config.yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git
```

Then run `aligntrue sync`. Personal-scope rules will be synced to that repository.

## Workflow: Keeping sensitive rules out of git

Use this when you have rules with internal details, credentials, or sensitive information that shouldn't be committed.

### Step 1: Mark the rule as private

Add `private: true` to the frontmatter:

```yaml
---
title: Internal Deployment Guide
description: Not for distribution
private: true
---
# Deployment Procedure

1. SSH into prod-1.internal
2. Run migration script
3. Monitor logs
```

### Step 2: Sync to apply gitignore

```bash
aligntrue sync
```

AlignTrue will:

- Add the rule file to `.gitignore`
- Add all exported files to `.gitignore`
- Update your agent exports without including the gitignored content

### Step 3: Verify it's gitignored

```bash
git status
# Should NOT show:
# .aligntrue/rules/internal-deployment-guide.md
# .cursor/rules/internal-deployment-guide.mdc
```

### Sharing with your team

If other team members need this rule:

1. Store it in a **private git repository** (e.g., `git@github.com:company/internal-rules.git`)
2. Each team member configures it as a source:

```yaml
# .aligntrue/config.yaml
sources:
  - type: local
    path: .aligntrue/rules
  - type: git
    url: git@github.com:company/internal-rules.git
    private: true # SSH URL auto-detected as private
```

3. Run `aligntrue sync` to pull the rules

Each team member will have the rules locally, but they won't be committed to their public repositories.

## Workflow: Personal rules in team mode

Use this when you have individual preferences that shouldn't affect the team's standard rules or require approval.

### Prerequisites

- You're using team mode (`mode: team` in config)
- Team rules are already set up

### Step 1: Create a personal rule

```yaml
---
title: My Editor Settings
description: Personal preferences
scope: personal
---
# Custom Keybindings

- Cmd+Shift+L: Format document
- Cmd+K Cmd+0: Fold all regions
```

### Step 2: Configure personal storage (optional)

If you want personal rules on only your machine:

```yaml
# .aligntrue/config.yaml
storage:
  personal:
    type: local # Machine-only, not version controlled
```

If you want to sync personal rules across machines:

```yaml
# .aligntrue/config.yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git
```

### Step 3: Sync

```bash
aligntrue sync
```

AlignTrue will:

- Process personal-scope rules separately from team rules
- Exclude personal rules from lockfile validation
- Store personal rules according to your storage config

### Step 4: Commit only team rules

When you're ready to commit:

```bash
# Only the lockfile changed (team rules only)
git add .aligntrue.lock.json
git commit -m "chore: Update team rules"

# Personal rules are either:
# - In .gitignore (local storage)
# - In .aligntrue/.remotes/personal (remote storage)
# Not in your main repo
```

### Checking personal rules don't leak

```bash
git status

# Good: only team files shown
# Modified: .aligntrue.lock.json

# Bad: personal rules showing
# New file: .aligntrue/rules/my-editor-settings.md (should NOT appear)
```

## Workflow: Remote backup for personal rules

Use this when you want personal rules synced across multiple machines with version control and backup.

### Prerequisites

- A private git repository for your personal rules (see [Personal Repository Setup](/docs/04-reference/personal-repo-setup) for detailed instructions)
- SSH access configured or HTTPS credentials ready

### Step 1: Create the remote repository

Create a private repository on GitHub, GitLab, or your git host (e.g., `git@github.com:yourusername/personal-rules.git`).

### Step 2: Configure personal storage as remote

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
description: Personal customizations
scope: personal
---
# Custom Commands

- My linting standards
- Editor shortcuts
- Development tools
```

### Step 4: Initial sync to remote

```bash
aligntrue sync
```

AlignTrue will:

- Clone the personal remote repository to `.aligntrue/.remotes/personal/`
- Write your personal rules to that repository
- Commit and push to your remote

### Step 5: Sync across machines

Now you can sync personal rules across machines:

```bash
# Machine A
aligntrue sync
# Personal rules pushed to remote

# Machine B
aligntrue sync
# Personal rules pulled from remote
```

Personal rules are now backed up and accessible from anywhere.

## Workflow: Combining dimensions

### Team standard with private storage

You have a team security policy that everyone needs, but you want to version-control it privately (not in the main repo):

```yaml
---
title: Security Policy
description: Required for all team members
private: true # Not in main repo
scope: team # Requires team approval
---
# Security Requirements

- Enable 2FA
- Never commit secrets
```

Configure storage:

```yaml
storage:
  team:
    type: remote
    url: git@github.com:company/team-rules.git
```

Result: Team members pull from the private repo, changes require approval, and everything is version-controlled.

### Experimental rules (gitignored + personal scope + local)

You're trying a new workflow and don't want to affect the team:

```yaml
---
title: Experimental AI Workflow
description: Testing new patterns
private: true # Don't commit
scope: personal # Don't require approval
---
# Trying new approach...
```

```yaml
storage:
  personal:
    type: local # Only on this machine
```

Result: Fully isolated experiment, nothing is committed, no approval needed.

## Changing dimensions

You can change any dimension at any time.

### Making a private rule public

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
# Before (team rule)
---
scope: team
---
# After (personal rule)
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

First, set remote storage:

```yaml
storage:
  personal:
    type: local # Current: machine-only
    # Change to:
    # type: remote
    # url: git@github.com:you/personal-rules.git
```

Then sync:

```bash
aligntrue sync
# Personal rules now synced to remote repository
```

Check the remote:

```bash
cd .aligntrue/.remotes/personal
git log  # See your personal rules with history
```

## Best practices

### Do

- Use `private: true` for internal documentation, sensitive configs, or anything with credentials
- Use `scope: personal` for individual workflow preferences that don't affect team standards
- Keep personal rules in a separate remote repository for easier management and backup
- Review your `.gitignore` after changing visibility to confirm expectations
- Use consistent naming: `personal` for scope, `private` for git visibility

### Don't

- Use `scope: personal` to bypass team review for shared standards
- Mark team security policies as `private: true` without discussion
- Use `storage.personal.type: local` if you need to sync multiple machines (use `remote` instead)
- Assume other team members see personal-scope rules (they won't, unless they configure the same remote)
- Change visibility just before committing without reviewing what gets gitignored

## Troubleshooting

### Rule still showing in git status after marking private

Run sync again to update `.gitignore`:

```bash
aligntrue sync
git status
```

If it still shows, manually remove the rule and staged changes:

```bash
git rm --cached .aligntrue/rules/rulename.md
git status  # Should now be gitignored
```

### Personal rules not excluding from lockfile

Make sure you set `scope: personal` (not just `private: true`):

```yaml
---
private: true # Prevents commit
scope: personal # Prevents lockfile inclusion (team mode only)
---
```

Then sync and check the lockfile:

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

Verify the repository exists and you have write access:

```bash
git clone git@github.com:yourusername/personal-rules.git /tmp/test
# Should succeed
```

### Personal rules not appearing on another machine

Make sure the second machine has the same remote configured:

```yaml
# Machine B: .aligntrue/config.yaml
storage:
  personal:
    type: remote
    url: git@github.com:yourusername/personal-rules.git # Same URL as Machine A
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
