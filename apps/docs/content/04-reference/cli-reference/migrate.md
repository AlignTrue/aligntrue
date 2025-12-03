---
description: Migrate rules between storage types and from other tools like Ruler
---

# Migrate command

Move rules between storage types and from other tools like Ruler.

## Overview

The migrate command helps you move rules to remote storage or transition from other rule management tools. It includes interactive wizards to guide you through setup.

## Usage

```bash
aligntrue migrate <subcommand> [options]
```

## Subcommands

### `personal` - Move personal rules to remote storage

Migrate personal rules from local-only storage to a remote git repository. This gives you version control and backup for your personal rules.

**Before you begin:**

Rules must be marked as personal before migration. Add `scope: personal` to the frontmatter of any rule file you want to be personal:

```yaml
---
title: My Personal Shortcuts
scope: personal
---
# My Personal Shortcuts

Personal coding preferences...
```

The migrate command changes where personal-scoped rules are stored, not which rules are personal.

**What it does:**

1. Checks if personal storage is already configured as remote
2. Launches an interactive wizard to set up a remote repository
3. Validates the repository URL (tests SSH/HTTPS access)
4. Updates `.aligntrue/config.yaml` to use remote storage
5. Configures branch name (defaults to `main`)

**Interactive wizard flow:**

```
? You'll need a private git repository for your personal rules.
  ○ I already have a repository (Enter URL now)
  ○ Create repository now (guided)
  ○ Set up later (stay local for now)
```

**Option 1: "I already have a repository"**

Enter your existing repository URL:

```
? Enter repository URL (or 'skip' to stay local):
  Placeholder: git@github.com:user/aligntrue-rules.git
```

Accepted formats:

- SSH: `git@github.com:user/aligntrue-rules.git`
- HTTPS: `https://github.com/user/aligntrue-rules.git`

**Option 2: "Create repository now (guided)"**

Shows a quick setup guide:

```
┌─────────────────────────────────────────────┐
│ Repository Setup Guide                      │
│                                             │
│ Quick Setup (5 minutes):                    │
│                                             │
│ 1. Create private repository                │
│    • GitHub: github.com/new                 │
│    • GitLab: gitlab.com/projects/new        │
│    • Bitbucket: bitbucket.org/repo/create   │
│                                             │
│ 2. Name it (suggestion: 'aligntrue-rules')  │
│    • Keep it private                        │
│    • Don't initialize with README           │
│                                             │
│ 3. Copy the SSH URL                         │
│    • Format: git@github.com:user/repo.git   │
│                                             │
│ 4. Ensure SSH access                        │
│    • Test: ssh -T git@github.com            │
│    • Setup keys: docs.github.com/ssh        │
│                                             │
│ 5. Return here and enter URL                │
└─────────────────────────────────────────────┘
```

After you create the repository, you'll enter the URL just like Option 1.

**Option 3: "Set up later (stay local for now)"**

Skip remote setup for now. Personal rules stay local in `.aligntrue/.local/personal/`.

You can configure remote storage anytime later:

```bash
aligntrue config set storage.personal.type remote
aligntrue config set storage.personal.url git@github.com:user/aligntrue-rules.git
```

**Configuration outcome:**

After successful setup, your `.aligntrue/config.yaml` will include:

```yaml
storage:
  personal:
    type: remote
    url: git@github.com:user/aligntrue-rules.git
    branch: main
```

**Examples:**

```bash
# Interactive migration with prompts
aligntrue migrate personal

# Skip confirmations (automated)
aligntrue migrate personal --yes

# Preview what would happen without making changes
aligntrue migrate personal --dry-run
```

**Related documentation:**

- [Personal Repository Setup](/docs/04-reference/personal-repo-setup)
- [Personal rules in team mode](/docs/03-concepts/team-mode#marking-sections-as-personal) - Details on marking rules as personal with `scope: personal`

---

### `team` - Move team rules to remote storage

Migrate team rules to a remote git repository. This is similar to personal migration but for team-scoped rules.

**What it does:**

1. Checks if team rules are already using remote storage
2. Launches an interactive wizard to set up a team repository
3. Validates repository access
4. Updates `.aligntrue/config.yaml` to use remote storage for team rules
5. Configures branch name

**Interactive wizard:**

The same 3-option wizard as personal migration, adapted for team scope:

```
? You'll need a private git repository for your team rules.
  ○ I already have a repository
  ○ Create repository now (guided)
  ○ Set up later (stay local for now)
```

**Configuration outcome:**

```yaml
storage:
  team:
    type: remote
    url: git@github.com:yourteam/aligntrue-team-rules.git
    branch: main
```

**Examples:**

```bash
# Interactive migration
aligntrue migrate team

# Skip prompts
aligntrue migrate team --yes

# Preview only
aligntrue migrate team --dry-run
```

**Related documentation:** [Team Mode](/docs/03-concepts/team-mode)

---

### `ruler` - Migrate from Ruler to AlignTrue

Automatically detects and converts Ruler configurations to AlignTrue format.

**What it does:**

1. Detects `.ruler/` directory and validates structure
2. Copies all `.ruler/*.md` files to `.aligntrue/rules/` (preserving directory structure)
3. Optionally includes `AGENTS.md` if it exists and wasn't generated by AlignTrue
4. Converts `ruler.toml` to `.aligntrue/config.yaml` (imports enabled exporters)
5. Optionally keeps `.ruler/` directory for reference

**Prerequisites:**

- `.ruler/` directory exists in current project
- At least one `.md` file in `.ruler/`

**Examples:**

```bash
# Interactive migration (prompts for confirmation)
aligntrue migrate ruler

# Migrate without prompts
aligntrue migrate ruler --yes

# Preview migration without making changes
aligntrue migrate ruler --dry-run
```

**Example output:**

```
Migrating from Ruler to AlignTrue

Copying files from .ruler/ to .aligntrue/rules/...
  ✓ 5 files copied

AGENTS.md found (not generated by AlignTrue)
? Include AGENTS.md in your rules? (y/N)

Note: .aligntrue/rules/ had existing files. Please review for duplicates.

Migration complete! Run "aligntrue sync" to export your rules to configured agents.
```

**Notes:**

- Ruler migration is also offered during `aligntrue init` if a `.ruler/` directory is detected
- Existing files in `.aligntrue/rules/` are preserved; review for duplicates
- The `.ruler/` directory can be kept for reference or removed

---

## Flags

| Flag          | Description                                        | Default |
| ------------- | -------------------------------------------------- | ------- |
| `--yes`, `-y` | Skip confirmation prompts (useful for automation)  | `false` |
| `--dry-run`   | Preview changes without applying any modifications | `false` |

---

## Exit codes

- `0` - Success
- `1` - Validation error (e.g., `.ruler/` not found for ruler migration, repository not accessible)
- `2` - System error (permissions, disk space, etc.)

---

## Troubleshooting

### "Repository not accessible" error

**Cause:** The URL you provided cannot be accessed. Usually SSH key or repository access issues.

**Possible fixes:**

```bash
# 1. Test SSH connection
ssh -T git@github.com

# 2. Ensure SSH key exists
ls -la ~/.ssh/id_ed25519.pub

# 3. Add SSH key to git host
# GitHub: github.com/settings/keys
# GitLab: gitlab.com/profile/keys

# 4. Test with explicit key
ssh -i ~/.ssh/id_ed25519 -T git@github.com

# 5. If using HTTPS, ensure credentials are configured
git config --global credential.helper store
```

**See also:** [Personal Repository Setup - Troubleshooting](/docs/04-reference/personal-repo-setup#troubleshooting)

### "No .ruler directory found" error

**Cause:** You're trying to run ruler migration but there's no `.ruler/` directory.

**Fix:**

1. Verify you're in the correct project directory
2. Check if rules are in a different location
3. If you don't have a `.ruler/` directory, start fresh with `aligntrue init`

### Personal/team migration shows "already using remote storage"

**Cause:** Remote storage is already configured for this scope.

**What to do:**

If you want to change the remote URL:

```bash
aligntrue config set storage.personal.url git@github.com:user/new-repo.git
```

---

## Common workflows

### Set up personal rules backup

```bash
# 1. Create private repository on GitHub
# 2. Run migration
aligntrue migrate personal

# 3. Follow wizard prompts to enter repository URL
# 4. Verify sync
aligntrue sync
```

### Move team to centralized repository

```bash
# 1. Create team repository
# 2. Enable team mode (if not already)
aligntrue team enable

# 3. Migrate team rules
aligntrue migrate team

# 4. Commit and push to main repository
git add .aligntrue/config.yaml
git commit -m "chore: Migrate team rules to remote storage"
git push
```

### Migrate from Ruler to AlignTrue

```bash
# 1. Run migration
aligntrue migrate ruler --dry-run

# 2. Review proposed changes
# 3. Run migration for real
aligntrue migrate ruler

# 4. Verify rules were copied
ls -la .aligntrue/rules/

# 5. Sync to export
aligntrue sync
```

---

## See also

- [Personal Repository Setup](/docs/04-reference/personal-repo-setup) - Detailed SSH and HTTPS setup
- [Team Mode](/docs/03-concepts/team-mode) - Team mode concepts and workflows
- [CLI Reference](/docs/04-reference/cli-reference) - All CLI commands
- [Troubleshooting](/docs/05-troubleshooting) - Common issues and solutions
