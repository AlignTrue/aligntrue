---
title: "Team-managed sections"
description: "How to define and work with team-controlled rule sections"
---

# Team-managed sections

Team-managed sections let you designate specific sections as controlled by the team lead, while allowing engineers to add their own personal sections.

## How it works

### Configuration

In `.aligntrue/config.yaml`:

```yaml
mode: team

managed:
  sections:
    - "Security"
    - "Compliance"
    - "Code Review Standards"
  source_url: "https://github.com/company/rules" # Optional: for display
```

### In exported files

Team-managed sections are marked with `[TEAM-MANAGED]` prefix and HTML comments:

```markdown
<!-- [TEAM-MANAGED]: This section is managed by your team.
Local edits will be preserved in backups but may be overwritten on next sync.
To keep changes, rename the section or remove from managed list. -->

## Security

[Team-controlled content here]
```

### What happens when you edit

1. **You edit a team-managed section locally**
2. **Run `aligntrue sync`**
3. **Your changes merge to IR** (via your configured edit_source)
4. **Lockfile validation checks bundle hash**
   - Soft mode: Warning shown, sync continues
   - Strict mode: Blocked until approved
5. **On next sync from team source:** Your edits may be overwritten
6. **Your edits are preserved in backups**

### Recovering your changes

If your edits to a team-managed section are overwritten:

```bash
# View backups
aligntrue backup list

# Restore from backup
aligntrue backup restore --to <timestamp>

# Or view backup diff
aligntrue revert --preview
```

### Keeping your changes

To keep your version of a team-managed section:

**Option 1: Rename the section**

```markdown
## Security (My Team)

[Your version here]
```

**Option 2: Remove from managed list**

Ask team lead to remove from `managed.sections` in config.

## Best practices

### For team leads

1. **Be selective** - Only manage sections that need central control
2. **Document clearly** - Use `managed.source_url` to point to source repo
3. **Review regularly** - Check for conflicts between team and personal sections
4. **Communicate changes** - Announce when updating managed sections

### For team members

1. **Respect markers** - Avoid editing `[TEAM-MANAGED]` sections
2. **Use personal sections** - Add your own sections with unique names
3. **Check backups** - If you accidentally edit managed sections
4. **Rename if needed** - Create personal variants of managed sections

## Example workflow

### Team lead sets up managed sections

```bash
# In central rules repo
cat > .aligntrue/config.yaml << EOF
mode: team
managed:
  sections:
    - "Security"
    - "Compliance"
  source_url: "https://github.com/company/rules"
EOF

git add .aligntrue/config.yaml
git commit -m "Define team-managed sections"
git push
```

### Engineer adds personal section

```bash
# In engineer's repo (pulls from central)
aligntrue sync # Gets team rules

# Edit AGENTS.md - add personal section
echo "## My Testing Preferences" >> AGENTS.md
echo "I prefer Jest with coverage > 80%" >> AGENTS.md

aligntrue sync # Syncs personal + team sections
```

### Engineer accidentally edits managed section

```bash
# Edit team-managed "Security" section
nano AGENTS.md # Changes "Security" section

aligntrue sync
# ⚠ Warning: Edited team-managed section "Security"
# Your changes are backed up and may be overwritten on next team sync

# Later, team sync overwrites it
aligntrue sync # Pulls latest from team

# Recover your version
aligntrue backup list
aligntrue revert --preview
# Copy your changes if you want to keep them
```

## Related

- [Team mode guide](/docs/01-guides/05-team-guide)
- [Workflows and scenarios](/docs/01-guides/01-workflows)
- [Backup and restore](/docs/04-reference/cli-reference#backup)
