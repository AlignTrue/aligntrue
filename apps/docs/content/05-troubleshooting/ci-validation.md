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
aligntrue md lint

# Or full check
aligntrue check
```

---

## Lockfile strict mode failures

**Error (CI):**

```
✖ Lockfile validation failed in strict mode
  2 rules have hash mismatches

Exit code: 1
```

**Cause:** CI is using `lockfile.mode: strict` and rules changed since last lockfile update.

**Fix:**

**1. Update lockfile in your branch:**

```bash
# Regenerate lockfile
aligntrue sync --force

# Commit updated lockfile
git add .aligntrue.lock.json
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

Automatically enables detected agents and manages ignore files without prompting:

```bash
aligntrue sync --yes
```

**Behavior with `--yes`:**

- Auto-enables any newly detected agents
- Auto-manages ignore files to prevent duplicate context
- Skips all interactive prompts
- Returns exit code 0 on success
- Returns exit code 1 on validation errors

**Option 2: Use `--non-interactive` (alias `-n`)**

Skips all prompts but doesn't auto-enable agents (useful if you want to be explicit):

```bash
aligntrue sync --non-interactive
# or
aligntrue sync -n
```

**Behavior with `--non-interactive`:**

- Skips agent detection prompts
- Skips ignore file management prompts
- Does not auto-enable agents
- Only syncs rules to already-configured exporters
- Useful for validated CI pipelines

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
