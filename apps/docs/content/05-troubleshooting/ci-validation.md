---
title: CI validation
description: Troubleshooting schema validation, lockfile checks, and CI automation in AlignTrue
---

# CI validation

Troubleshooting validation and lockfile issues in CI/CD pipelines.

## Schema validation failures

**Error:**

```
✖ Schema validation failed:
  Line 15: Missing required field 'spec_version'
  Line 23: Invalid severity 'critical' (must be: error, warn, info)
```

**Cause:** Rules don't match JSON Schema requirements.

**Common schema mistakes:**

**1. Missing required fields:**

```yaml
# ❌ Missing fields
id: my-rule
summary: Do the thing

# ✅ All required fields
id: my-project.category.my-rule
version: "1.0.0"
spec_version: "1"
rules:
  - id: do-the-thing
    summary: Do the thing
    severity: error
```

**2. Invalid severity:**

```yaml
# ❌ Wrong values
severity: critical
severity: MUST

# ✅ Valid values
severity: error   # Must fix
severity: warn    # Should fix
severity: info    # Nice to have
```

**3. Invalid rule ID pattern:**

```yaml
# ❌ Too short or special chars
id: rule1
id: my-project/rule

# ✅ Valid format (namespace.category.name)
id: my-project.backend.use-typescript
id: acme.security.no-secrets
```

**Fix:**

```bash
# Validate locally before committing
aligntrue check

# For verbose output
aligntrue check --json
```

**Quick fix checklist:**

- Run `aligntrue check --json` to pinpoint failing fields.
- Add missing frontmatter keys (`id`, `version`, `spec_version`) and valid severities (`error|warn|info`).
- Normalize IDs to `namespace.category.name` (no slashes, no short IDs).
- Re-run `aligntrue check` until it returns exit code 0.

---

## Lockfile strict mode failures

**Error (CI):**

```
✖ Lockfile validation failed in strict mode
  2 rules have hash mismatches

Exit code: 1
```

**Cause:** CI is using `lockfile.mode: strict` and rules changed since the last lockfile update. Current lockfile path is `.aligntrue/lock.json` (AlignTrue will migrate legacy `.aligntrue/lock.json` when you run sync).

**Fix:**

**1. Refresh the lockfile in your branch:**

```bash
# Regenerate lockfile (accept prompts, auto-add detected agents)
aligntrue sync --yes

# Commit updated lockfile
git add .aligntrue/lock.json
git commit -m "chore: update lockfile after rule changes"
git push
```

**2. Or temporarily use soft mode in CI:**

```yaml
# .aligntrue/config.yaml
lockfile:
  mode: soft # Warn but don't block CI
```

---

## Exit code meanings

**Exit code 0 - Success:**

All validations passed. Safe to merge.

**Exit code 1 - Validation error:**

- Schema validation failed
- Lockfile drift detected (strict mode)
- User-fixable issues

**Action:** Fix the validation errors and retry.

**Exit code 2 - System error:**

- Config file not found
- Permissions error
- Disk space issues
- Unexpected failures

**Action:** Check system logs, verify file permissions, ensure sufficient disk space.

---

## Running sync in CI/automation

### Non-interactive mode

By default, `aligntrue sync` shows interactive prompts for agent detection and ignore file management. To run in CI/automation workflows, use one of these flags:

**Option 1: Use `--yes` (recommended)**

Automatically accepts prompts, enables detected agents, and manages ignore files using your configured defaults:

```bash
aligntrue sync --yes
```

**Behavior with `--yes`:**

- Adds newly detected agents to `.aligntrue/config.yaml`
- Applies ignore-file updates using `sync.auto_manage_ignore_files` defaults (on by default)
- Overwrites conflicts using the default resolution strategy
- Skips all interactive prompts (including overwrite confirmations)
- Returns exit code 0 on success
- Returns exit code 1 on validation errors

**Option 2: Use `--non-interactive` (alias `-n`)**

Skips prompts and uses defaults (also auto-adds detected agents, but does not imply `--force`):

```bash
aligntrue sync --non-interactive
# or
aligntrue sync -n
```

**Behavior with `--non-interactive`:**

- Adds newly detected agents to `.aligntrue/config.yaml`
- Applies ignore-file updates using `sync.auto_manage_ignore_files` defaults (on by default)
- Uses overwrite as the default resolution strategy for conflicts
- Skips detection and ignore-file prompts
- Useful for validated CI pipelines that need zero prompts

### Common CI patterns

**GitHub Actions example:**

```yaml
- name: Sync with AlignTrue
  run: aligntrue sync --yes
```

**GitLab CI example:**

```yaml
aligntrue-sync:
  script:
    - aligntrue sync --yes
```

**Jenkins example:**

```groovy
stage('Sync Rules') {
  steps {
    sh 'aligntrue sync --yes'
  }
}
```

### Dry-run for validation

To preview changes without writing files:

```bash
aligntrue sync --dry-run --yes
```

This is useful for:

- Validating that rules will sync correctly
- Checking for schema errors
- Previewing exporter output
- Pre-flight checks before deployment
- Ensuring lockfile and agent updates are understood before writing files

---

## Quick CI tips

- Always run `aligntrue check --ci` before `aligntrue sync` in pipelines.
- Use `aligntrue sync --dry-run --yes` to preview, then `aligntrue sync --yes` to write files (lockfile included).
- Commit `.aligntrue/lock.json` whenever rules change in team mode; CI strict mode will block drift.
