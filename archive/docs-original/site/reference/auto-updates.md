# Auto-updates

Automatic update detection and application for team mode rule sources.

## Overview

AlignTrue's auto-update system helps teams stay current with approved rule sources. When sources publish new versions, you can detect, review, and apply updates with confidence.

**Key features:**

- Detect available updates from allowed sources
- Preview changes before applying
- Automatic UPDATE_NOTES.md generation
- CI integration for scheduled checks
- Automatic sync after updates

## Manual workflow

### Check for updates

Preview available updates without making changes:

```bash
aligntrue update check
```

Example output:

```
Available Updates
=================

Source: git:https://github.com/AlignTrue/base-global
  Current: abc123...
  Latest:  def456...
  Affected rules: security/no-eval, perf/async-await

Summary:
  1 source(s) updated
  2 rule(s) affected
  0 breaking change(s)

Run 'aligntrue update apply' to apply these updates.
```

### Apply updates

Apply detected updates and generate UPDATE_NOTES.md:

```bash
aligntrue update apply
```

This will:

1. Detect available updates
2. Generate UPDATE_NOTES.md with change summary
3. Run `aligntrue sync --force` to apply changes
4. Update `.aligntrue.lock.json` with new hashes

### Dry run

Preview what would be applied without making changes:

```bash
aligntrue update apply --dry-run
```

## CI integration

### GitHub Actions workflow

Create `.github/workflows/check-aligntrue-updates.yml`:

```yaml
name: Check AlignTrue updates

on:
  schedule:
    - cron: "0 0 * * 1" # Weekly on Monday
  workflow_dispatch:

jobs:
  check-updates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install AlignTrue CLI
        run: npm install -g @aligntrue/cli

      - name: Check for updates
        id: check
        run: |
          if aligntrue update check | grep -q "No updates available"; then
            echo "has_updates=false" >> $GITHUB_OUTPUT
          else
            echo "has_updates=true" >> $GITHUB_OUTPUT
          fi

      - name: Apply updates
        if: steps.check.outputs.has_updates == 'true'
        run: aligntrue update apply

      - name: Create Pull Request
        if: steps.check.outputs.has_updates == 'true'
        uses: peter-evans/create-pull-request@v5
        with:
          commit-message: "chore: update AlignTrue sources"
          title: "Update AlignTrue rule sources"
          body-path: UPDATE_NOTES.md
          branch: aligntrue-updates
          delete-branch: true
```

### GitLab CI/CD

Add to `.gitlab-ci.yml`:

```yaml
check-aligntrue-updates:
  image: node:20
  script:
    - npm install -g @aligntrue/cli
    - aligntrue update check
    - |
      if ! aligntrue update check | grep -q "No updates available"; then
        aligntrue update apply
        git config user.name "GitLab CI"
        git config user.email "ci@gitlab.com"
        git add .
        git commit -m "chore: update AlignTrue sources"
        # Create merge request via GitLab API
      fi
  rules:
    - if: '$CI_PIPELINE_SOURCE == "schedule"'
    - if: '$CI_PIPELINE_SOURCE == "web"'
```

## UPDATE_NOTES.md format

Generated automatically by `aligntrue update apply`:

```markdown
# AlignTrue update notes

Generated: 2025-10-30 12:00:00

## Summary

- 2 sources updated
- 5 rules affected
- 0 breaking changes

## Updates

### AlignTrue/base-global (org/repo)

- Previous: abc123 (2025-10-25)
- Current: def456 (2025-10-30)
- Affected rules: security/no-eval, perf/async-await
- Breaking: No

### AlignTrue/typescript-pack

- Previous: xyz789 (2025-10-28)
- Current: new123 (2025-10-30)
- Affected rules: ts/strict-mode, ts/no-any, ts/explicit-returns
- Breaking: No

## Next steps

1. Review changes in affected rules
2. Run `aligntrue check` to validate
3. Test your project with updated rules
4. Commit changes when satisfied
```

## Best practices

### Review cycle

**Weekly checks:** Schedule weekly update checks during low-traffic periods.

**Review before merge:** Always review UPDATE_NOTES.md before merging auto-update PRs. Check:

- What rules changed and why
- Impact on your codebase
- Breaking changes (if any)
- Upstream release notes

**Test locally:** For major updates, test locally before merging:

```bash
git checkout aligntrue-updates
aligntrue check
# Run your project's tests
git merge aligntrue-updates
```

### Allow list hygiene

Keep your allow list current:

```bash
# Review approved sources
aligntrue team list-allowed

# Remove deprecated sources
aligntrue team remove <source>
```

### Breaking changes

When breaking changes detected:

1. Review the change in UPDATE_NOTES.md
2. Check if your code needs updates
3. Use severity remapping if temporary exception needed
4. Document rationale in `.aligntrue.team.yaml`

### Rollback procedure

If updates cause issues:

```bash
# Revert the update
git revert HEAD

# Or restore from backup
aligntrue backup restore <backup-id>

# Sync to previous state
aligntrue sync --force
```

## Troubleshooting

### No updates detected

**Symptom:** `aligntrue update check` shows no updates, but you expect them.

**Causes:**

- Source not in allow list
- Allow list has stale resolved_hash
- Not in team mode

**Fix:**

```bash
# Check team mode
aligntrue team status

# Re-approve source to refresh hash
aligntrue team approve <source>

# Check allow list
cat .aligntrue/allow.yaml
```

### Update fails to apply

**Symptom:** `aligntrue update apply` errors during sync.

**Causes:**

- Conflicting local changes
- Missing dependencies
- Network issues

**Fix:**

```bash
# Check for local changes
git status

# Try with force flag (already used by update apply)
aligntrue sync --force

# Review error details
aligntrue check --verbose
```

### CI workflow not triggering

**Symptom:** Scheduled workflow doesn't run.

**Causes:**

- Workflow file not committed
- Schedule syntax error
- Repository permissions

**Fix:**

```bash
# Validate workflow syntax
cat .github/workflows/check-aligntrue-updates.yml

# Check GitHub Actions permissions
# Settings > Actions > General > Workflow permissions

# Test manually
gh workflow run check-aligntrue-updates.yml
```

### UPDATE_NOTES.md not generated

**Symptom:** `aligntrue update apply` succeeds but no notes file.

**Causes:**

- Write permission issues
- Current directory not repo root

**Fix:**

```bash
# Check current directory
pwd

# Check write permissions
ls -la | grep UPDATE_NOTES.md

# Run from repo root
cd "$(git rev-parse --show-toplevel)"
aligntrue update apply
```

## Related docs

- [Team mode guide](./team-mode.md) - Enable and configure team mode
- [Drift detection](./drift-detection.md) - Monitor alignment drift
- [Git workflows](./git-workflows.md) - Pull and link commands
- [Commands reference](./commands.md) - Complete command documentation

---

For questions or issues, see [troubleshooting guide](./troubleshooting.md) or open an issue on GitHub.
