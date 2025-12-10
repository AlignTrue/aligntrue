---
description: Understanding local backups in AlignTrue
---

# Backup

AlignTrue provides local backups for safety snapshots. To publish or mirror rules to git remotes, use the `remotes` commands (separate from backups).

## Local backups

Local backups create snapshots of your `.aligntrue/` directory before potentially destructive operations. They are stored in `.aligntrue/.backups/` and are automatically managed.

### Automatic backups

AlignTrue creates safety backups automatically before:

- Running `aligntrue sync`
- Restoring from a backup
- Running migrations

### Manual backups

Create a backup manually with optional notes:

```bash
aligntrue backup create --notes "Before major refactor"
```

### Retention policy

Configure retention in `.aligntrue/config.yaml`:

```yaml
backup:
  retention_days: 30 # Remove backups older than 30 days
  minimum_keep: 3 # Always keep at least 3 backups
```

Set `retention_days: 0` to disable automatic cleanup.

## Publishing to remotes (separate from backups)

To publish or mirror rules to git remotes, configure `remotes`. Pushes happen during `aligntrue sync` by default unless you set `auto: false` on a remote—use `aligntrue remotes push` for explicit/manual pushes. See the remotes CLI reference and [Rule sharing & privacy](/docs/01-guides/06-rule-sharing-privacy) for routing.

## Personal sources and team mode

In team mode, sources marked as `personal: true` skip team approval requirements:

```yaml
mode: team
sources:
  - type: git
    url: git@github.com:team/standards.git # Team source - approval required

  - type: git
    url: git@github.com:me/personal.git
    personal: true # Personal - no approval needed
    gitignore: true # Exports gitignored; source file still tracked unless you gitignore it
```

This lets team members have personal rules that:

- Update without team approval
- Keep their exported artifacts out of the shared repository (sources remain tracked unless you also gitignore them)
- Can be pushed to their own private repository (pushed on sync by default; set `auto: false` to push manually with `aligntrue remotes push`)

## Gitignored rules

Rules from sources with `gitignore: true` or rules with `gitignore: true` in frontmatter automatically add their **exported files** to a managed block in `.gitignore` (source files are unchanged):

```yaml
# In config
sources:
  - type: git
    url: git@github.com:me/private-rules.git
    gitignore: true
```

Or in rule frontmatter:

```yaml
---
title: My Personal Preferences
gitignore: true
---
```

SSH URLs (`git@...`) automatically set `gitignore: true`.

## Related

- [CLI reference: backup](/reference/cli/backup)
- [CLI reference: remotes](/reference/cli/remotes)
- [Sharing rules with others](/guides/sharing-rules)
- [Team mode](/concepts/team-mode)
