---
title: Joining a team
description: Guide for team members joining a project with AlignTrue team mode
---

# Joining an existing team

This guide walks you through joining a project that already uses AlignTrue in team mode.

## What is AlignTrue doing in your project?

Your team uses AlignTrue to manage AI assistant rules. Here's what you need to know:

- **Your team has shared rules** stored in `.aligntrue/rules/` that define how AI assistants (Cursor, Copilot, Claude, etc.) should behave in this codebase
- **Rules sync to agent files** like `.cursor/rules/*.mdc` and `AGENTS.md` - these are auto-generated, don't edit them directly
- **It just works** - after cloning, run `aligntrue sync` and you'll have the team's rules applied

**The important thing:** You don't need to configure anything. Just sync and the team rules work automatically.

## Quick start

```bash
# Clone the repo
git clone git@github.com:yourteam/project.git
cd project

# Sync rules to your AI assistants
aligntrue sync

# Done! Open Cursor or your AI assistant and the rules are active
```

That's it for most team members. The sections below cover optional personal configuration.

---

## Understanding the two-file config system

Your project has two configuration files:

| File                          | Purpose                                         | Git status |
| ----------------------------- | ----------------------------------------------- | ---------- |
| `.aligntrue/config.team.yaml` | Team settings (rules, exporters, lockfile mode) | Committed  |
| `.aligntrue/config.yaml`      | Your personal settings (optional)               | Gitignored |

When you first sync in a team repo, AlignTrue creates an empty `.aligntrue/config.yaml` for your personal settings and keeps it gitignored. You can ignore it or use it to:

- Add personal rule sources
- Override team settings locally (e.g., for testing)
- Configure personal remotes (pushes on sync by default; set `auto: false` to push manually with `aligntrue remotes push`)

---

## Personal settings (optional, for power users)

### Adding personal rules (optional)

After initialization, you can optionally add personal rules. There are three approaches:

**Option 1: Team rules only (default)**

If you don't need personal rules, you're done. Just run `aligntrue init` and `aligntrue sync`.

**Option 2: Personal rules (local only)**

Create rules in `.aligntrue/rules/` with `scope: personal` in the frontmatter:

```yaml
---
title: My Preferences
scope: personal
gitignore: true # Exports gitignored; source stays tracked unless you gitignore it
---
```

These rules will have their exported files gitignored and won't require team approval. The source markdown stays tracked unless you gitignore it or run with `git.mode: ignore`.

**Option 3: Personal rules (with personal remote)**

For personal rules that sync across your machines:

```bash
# 1. Import rules from your personal repo (one-time copy)
aligntrue add https://github.com/yourusername/personal-rules

# 2. Configure it as a push destination
aligntrue add remote https://github.com/yourusername/personal-rules --personal
```

Now rules with `scope: personal` will push to your personal repo during `aligntrue sync` by default. Set `auto: false` if you prefer to push manually with `aligntrue remotes push`.

See [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy) for complete details on personal rule workflows.

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
aligntrue config show
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

- Generated exports from team + personal rules
- Git-ignored by default (recommended)
- Regenerated on each sync (backups taken before overwrite)
- Read-only - changes are backed up but overwritten on sync
- Always edit `.aligntrue/rules/` instead to make changes

## Making changes

### Editing team rules

To propose changes to team rules:

1. Edit files in `.aligntrue/rules/`
2. Run `aligntrue sync`
3. Commit the changes to `.aligntrue/rules/` and agent exports
4. Push and create a PR
5. Team lead reviews and approves
6. After merge, everyone runs `aligntrue sync` to get updates

### Editing personal rules

To change your personal rules:

1. Edit files in `.aligntrue/rules/` (personal sections)
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

### Strict (lockfile validation)

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
   # Edit .aligntrue/rules/
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

1. Edit your personal rules in `.aligntrue/rules/` (files with `scope: personal`)
2. Run `aligntrue sync`
3. Changes stay local or sync to your personal remote (no PR needed)

### Resolve drift

If CI reports drift:

```bash
# Check what changed
aligntrue drift

# If you made the change, create PR for team lead to review:
git add .aligntrue/lock.json
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

### Personal rules not showing

**Cause:** Personal rules might not be configured correctly.

**Fix:**

1. Ensure your rules have `scope: personal` in frontmatter
2. If using a remote, verify it's configured:

```bash
# Check your config
cat .aligntrue/config.yaml

# Look for remotes.personal section
```

See [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy) for setup instructions.

### Agent files Not Generated

**Cause:** Exporters might not be enabled.

**Fix:**

```bash
# Check enabled exporters
aligntrue exporters list

# Enable missing exporters
aligntrue exporters enable cursor
aligntrue exporters enable agents

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

- ❌ Commit agent files to the repository (they're generated)
- ❌ Edit agent files directly (edit `.aligntrue/rules/` instead)
- ❌ Skip `scope: personal` on personal rules (they'll be tracked in lockfile)
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
