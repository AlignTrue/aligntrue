---
title: Joining a team
description: Guide for team members joining a project with AlignTrue team mode
---

# Joining an existing team

This guide walks you through joining a project that already uses AlignTrue in team mode.

## Prerequisites

- AlignTrue CLI installed (`npm install -g @aligntrue/cli`)
- Access to the team's repository
- Git configured with your credentials

## Step 1: Clone the repository

```bash
git clone git@github.com:yourteam/project.git
cd project
```

## Step 2: Initialize AlignTrue

Run the init command:

```bash
aligntrue init
```

AlignTrue will detect the existing team configuration and show you a summary:

```
✓ Detected team mode configuration

Team Configuration:
  Mode: team
  Approval: pr_approval (relaxed)
  Team sections: Security, Compliance, Architecture

Your Options:
  1. Use team rules only (no personal rules)
  2. Add personal rules (local only)
  3. Add personal rules (with remote backup)
```

### Option 1: Team Rules Only

Select this if you don't need any personal rules:

```bash
aligntrue init --team-only
```

This is the simplest setup. All rules come from the team repository.

### Option 2: Personal Rules (Local)

Select this if you want personal rules but don't need version control:

```bash
aligntrue init --with-personal-local
```

Your personal rules will be stored in `.aligntrue/.local/personal/` and git-ignored.

### Option 3: Personal Rules (Remote)

Select this if you want personal rules with version control and backup:

```bash
aligntrue init --with-personal-remote
```

You'll be prompted to set up a remote repository. See [Personal Repository Setup](/reference/personal-repo-setup) for details.

## Step 3: Initial Sync

After initialization, sync the rules to your agent files:

```bash
aligntrue sync
```

This will:

1. Load team rules from the repository
2. Load your personal rules (if configured)
3. Merge them together
4. Export to agent files (`.cursor/rules/*.mdc`, `AGENTS.md`, etc.)

## Step 4: Verify Setup

Check that rules were exported correctly:

```bash
# List generated files
ls -la .cursor/rules/
cat AGENTS.md

# Check configuration
aligntrue config
```

## Understanding team mode

### Team rules

Team rules are:

- Stored in `.aligntrue/rules` in the main repository
- Committed to version control
- Visible to all team members
- Require approval to change (depending on mode)

### Personal rules

Personal rules are:

- Stored locally or in a private remote
- Not visible to other team members
- Can be changed without approval
- Merged with team rules during sync

### Agent files

Agent files (`.cursor/rules/*.mdc`, `AGENTS.md`) are:

- Generated from team + personal rules
- Git-ignored by default (recommended)
- Regenerated on each sync
- Safe to edit locally (changes sync back to IR)

## Making changes

### Editing team rules

To propose changes to team rules:

1. Edit `AGENTS.md` or agent files directly
2. Run `aligntrue sync`
3. Commit the changes to `.aligntrue/rules`
4. Push and create a PR
5. Team lead reviews and approves
6. After merge, everyone runs `aligntrue sync` to get updates

### Editing personal rules

To change your personal rules:

1. Edit `AGENTS.md` or agent files (personal sections)
2. Run `aligntrue sync`
3. Changes stay local or sync to your personal remote
4. No approval needed

## Approval modes

Your team may use different approval modes:

### Relaxed (pr_approval)

- Changes go through normal PR process
- No special AlignTrue approval needed
- CI validates lockfile integrity
- Most common for internal teams

### Strict (allowlist)

- Changes must be explicitly approved via git PR
- `aligntrue drift --gates` fails in CI if unapproved
- Team lead reviews and merges PR with lockfile changes
- More common for external dependencies

Check your team's mode:

```bash
aligntrue config get approval.internal
```

## Common workflows

### Daily sync

Pull latest team rules:

```bash
git pull
aligntrue sync
```

### Propose rule change

1. Create a branch:

   ```bash
   git checkout -b add-security-rule
   ```

2. Edit rules:

   ```bash
   # Edit AGENTS.md or agent files
   aligntrue sync
   ```

3. Commit and push:

   ```bash
   git add .aligntrue/rules
   git commit -m "feat: Add security scanning rule"
   git push origin add-security-rule
   ```

4. Create PR and wait for approval

### Update personal rules

1. Edit your personal sections in `AGENTS.md`
2. Run `aligntrue sync`
3. Changes stay local (no PR needed)

### Resolve drift

If CI reports drift:

```bash
# Check what changed
aligntrue drift

# If you made the change, create PR for team lead to review:
git add .aligntrue.lock.json
git commit -m "chore: Update lockfile"
git push origin feature-branch

# Or revert your changes:
git checkout .aligntrue/rules
aligntrue sync
```

## Troubleshooting

### Sync fails with "Lockfile Mismatch"

**Cause:** Your rules don't match the approved lockfile.

**Fix:**

```bash
# Pull latest changes
git pull

# Sync again
aligntrue sync

# If still failing, check for local modifications
git status
```

### Personal rules Not Showing

**Cause:** Personal rules might not be configured correctly.

**Fix:**

```bash
# Check configuration
aligntrue config get storage.personal

# Reconfigure if needed
aligntrue init --with-personal-local
```

### Agent files Not Generated

**Cause:** Exporters might not be enabled.

**Fix:**

```bash
# Check enabled exporters
aligntrue adapters list

# Enable missing exporters
aligntrue adapters enable cursor
aligntrue adapters enable agents

# Sync again
aligntrue sync
```

### Remote personal repo fails

**Cause:** SSH access or repository not configured.

**Fix:**

See [Personal Repository Setup](/reference/personal-repo-setup) for detailed troubleshooting.

## Best practices

### DO

- ✅ Run `aligntrue sync` after pulling changes
- ✅ Keep agent files git-ignored (recommended)
- ✅ Use personal rules for machine-specific preferences
- ✅ Create PRs for team rule changes
- ✅ Review lockfile changes in PRs

### DON'T

- ❌ Commit agent files to the repository
- ❌ Edit `.aligntrue/rules` directly
- ❌ Put personal rules in the main repository
- ❌ Skip sync after pulling changes
- ❌ Force push lockfile changes

## Getting help

If you're stuck:

1. Check the [Troubleshooting Guide](/reference/troubleshooting/remote-access)
2. Ask your team lead about team-specific configuration
3. Run `aligntrue check` to validate your setup
4. Check logs: `aligntrue sync --verbose`

## Next steps

- [Understand Team Mode](/concepts/team-mode)
- [Set Up Personal Repository](/reference/personal-repo-setup)
- [Learn About Scopes](/concepts/scopes)
- [Explore Migration Commands](/reference/cli/migrate)
