# Overlays Guide

**Status:** Stable (Phase 3.5)

Overlays let you customize third-party packs without forking. Change severity, add check inputs, or remove autofix while preserving upstream updates.

---

## Quick Start (60 seconds)

**Scenario:** You use `@acme/standards` but want to treat one check as an error.

```yaml
# .aligntrue.yaml
spec_version: "1"
profile:
  id: my-team/backend
  version: 0.1.0

sources:
  - git: https://github.com/acme/standards
    ref: v1.2.0
    path: packs/base.yaml

overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-console-log"
    override:
      severity: error
```

Run sync:

```bash
aln sync
# Output:
# ✓ Applied 1 overlay to @acme/standards
# ✓ Lockfile updated with overlay hash
```

**Result:** `no-console-log` now fails CI instead of warning, and you still get upstream updates with `aln update --safe`.

---

## When to Use Overlays vs Plugs vs Forks

### Decision Tree

```
Need to customize a third-party pack?
│
├─ Change exists in pack definition? (severity, inputs, autofix)
│  ├─ YES → Use overlay (this guide)
│  └─ NO → Continue...
│
├─ Customization is agent-specific? (AI prompt, tool config)
│  ├─ YES → Use plug (see docs/plugs.md)
│  └─ NO → Continue...
│
└─ Need to change check logic or add new checks?
   └─ YES → Fork pack or create custom pack
```

### When to Use Overlays

✅ **Change severity:** Warning → error, or disable a check  
✅ **Add check inputs:** Pass project-specific config to checks  
✅ **Remove autofix:** Keep check but disable automatic fixes  
✅ **Temporary adjustments:** Override during migration, restore later

❌ **Don't use overlays for:**

- Changing check logic (fork instead)
- Adding new checks (create custom pack)
- Agent-specific config (use plugs)

### When to Use Plugs

✅ **Agent-specific config:** Cursor AI prompt, VS Code settings  
✅ **Template slots:** Fill variables in agent config  
✅ **Non-deterministic data:** User names, workspace paths

See `docs/plugs.md` for plug documentation.

### When to Fork

✅ **Major changes:** Rewrite check logic, change structure  
✅ **Divergent requirements:** Your needs differ fundamentally  
✅ **No upstream updates needed:** You maintain your version

---

## Overlay Anatomy

### Basic Overlay

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards" # Required: pack to modify
      check_id: "no-console-log" # Optional: specific check
    override:
      severity: error # Change severity
```

### Advanced Overlay

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "max-complexity"
      scope: "backend/**" # Only in backend/
    override:
      inputs:
        threshold: 15 # Add/merge inputs
      severity: warning
      autofix: false # Disable autofix
    metadata:
      reason: "Backend needs higher complexity during migration"
      expires: "2025-12-31"
      owner: "backend-team"
```

---

## Selector Strategies

### By Pack Only

Applies to all checks in a pack:

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
    override:
      severity: warning # Downgrade everything to warning
```

**Use when:** Trialing a new pack, gradual rollout.

### By Check ID

Applies to one specific check:

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-console-log"
    override:
      severity: error
```

**Use when:** Most checks are fine, one needs adjustment.

### By Scope

Applies to checks in specific paths:

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      scope: "tests/**"
    override:
      severity: off # Disable checks in tests/
```

**Use when:** Different rules for different directories.

### Combining Selectors

All conditions must match (AND logic):

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-await-in-loop"
      scope: "scripts/**"
    override:
      severity: off # Only disable in scripts/
```

---

## Override Capabilities

### Severity Levels

```yaml
override:
  severity: off       # Disable check entirely
  # OR
  severity: info      # Informational only
  # OR
  severity: warning   # Default for most checks
  # OR
  severity: error     # Fail CI
```

### Check Inputs

Merge with upstream inputs (deep merge):

```yaml
# Upstream defines:
# inputs:
#   maxLength: 80
#   allowUrls: true

overlays:
  - selector:
      check_id: "line-length"
    override:
      inputs:
        maxLength: 120 # Overrides upstream
        ignoreComments: true # Adds new input
        # allowUrls: true (preserved from upstream)
```

### Autofix Control

```yaml
override:
  autofix: false # Disable autofix, keep check
```

**Use when:** Want manual fixes, or autofix is risky in your codebase.

---

## Advanced Patterns

### Multiple Overlays

Apply multiple overlays to same pack:

```yaml
overlays:
  # Disable checks in tests
  - selector:
      source_pack: "@acme/standards"
      scope: "tests/**"
    override:
      severity: off

  # Stricter in production code
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-console-log"
      scope: "src/**"
    override:
      severity: error
```

**Precedence:** Most specific selector wins (check_id + scope > check_id > pack).

### Temporary Overrides

Document expiration dates:

```yaml
overlays:
  - selector:
      check_id: "no-deprecated-api"
    override:
      severity: warning
    metadata:
      reason: "Migration to new API in progress"
      expires: "2025-12-31"
      owner: "platform-team"
```

Use `aln override status` to audit expired overrides.

### Migration Workflow

Gradually adopt stricter rules:

```yaml
# Week 1: Disable new check
overlays:
  - selector:
      check_id: "new-security-rule"
    override:
      severity: off

# Week 2: Enable as warning
overlays:
  - selector:
      check_id: "new-security-rule"
    override:
      severity: warning

# Week 3: Remove overlay (use upstream default: error)
# overlays: []
```

---

## Conflict Resolution

### What Causes Conflicts?

**Stale selectors:** Upstream renamed or removed a check.

```yaml
# Upstream renamed "no-console-log" → "no-console-statements"
overlays:
  - selector:
      check_id: "no-console-log" # ❌ No longer exists
    override:
      severity: error
```

**Resolution:** Run `aln override status` to detect stale selectors, update to new check ID.

**Ambiguous selectors:** Multiple checks match.

```yaml
# Both "@acme/standards" and "@acme/security" have "no-console-log"
overlays:
  - selector:
      check_id: "no-console-log" # ❌ Ambiguous
    override:
      severity: error
```

**Resolution:** Add `source_pack` to disambiguate.

**Conflicting overrides:** Multiple overlays target same check.

```yaml
overlays:
  - selector:
      check_id: "no-console-log"
    override:
      severity: error
  - selector:
      check_id: "no-console-log"
      scope: "src/**"
    override:
      severity: warning # ❌ Conflicts with above
```

**Resolution:** Most specific selector wins (check_id + scope > check_id).

### Three-Way Merge

When upstream changes conflict with your overlay:

```bash
aln update --safe
# Output:
# ⚠ Conflict in overlay for check "no-console-log"
# Upstream changed: severity warning → error
# Your overlay: severity error, inputs: { exclude: ["debug.ts"] }
#
# Options:
# 1. Keep your overlay (ignore upstream change)
# 2. Accept upstream change (remove overlay)
# 3. Merge manually (edit overlay)
#
# Conflict patch saved to: .aligntrue/.conflicts/overlay-no-console-log.patch
```

View three-way diff:

```bash
aln override diff no-console-log
# Shows:
# - Upstream original
# - Upstream new
# - Your overlay
```

---

## Team Workflows

### Overlay Approval

Require review for overlays in CI:

```yaml
# .aligntrue.team.yaml
overlay_policy:
  require_approval: true
  allowed_overrides:
    - severity # Can change severity without approval
  restricted_overrides:
    - autofix # Requires approval
```

See `docs/team-mode.md` for team policies.

### Overlay Dashboard

Audit all overlays:

```bash
aln override status

# Output:
# Overlays (3 active, 1 stale)
#
# ✓ @acme/standards → no-console-log (severity: error)
#   Reason: Production logging policy
#   Owner: platform-team
#   Healthy: yes
#
# ✓ @acme/standards → max-complexity (inputs: {threshold: 15})
#   Reason: Backend migration in progress
#   Expires: 2025-12-31
#   Healthy: yes
#
# ⚠ @acme/standards → no-deprecated-api (severity: warning)
#   Reason: Migration to new API
#   Expires: 2025-10-15 (EXPIRED)
#   Healthy: stale
#
# ❌ @acme/security → old-check-name (severity: off)
#   Reason: Unknown
#   Healthy: no (check not found in upstream)
```

---

## Overlay Hashing and Lockfile

### Triple-Hash Lockfile

Overlays are deterministic and hashed separately:

```json
{
  "spec_version": "1",
  "generated_at": "2025-10-31T12:00:00Z",
  "dependencies": {
    "@acme/standards": {
      "version": "1.2.0",
      "source": {
        "type": "git",
        "url": "https://github.com/acme/standards",
        "ref": "v1.2.0",
        "commit": "abc123"
      },
      "content_hash": "sha256:upstream-content-hash",
      "overlay_hash": "sha256:overlay-modifications-hash",
      "final_hash": "sha256:combined-hash"
    }
  }
}
```

**content_hash:** Upstream pack content  
**overlay_hash:** Your overlay modifications  
**final_hash:** Combined result after overlays applied

### Drift Detection

Detect overlay staleness:

```bash
aln drift

# Output:
# Drift detected (2 issues)
#
# Overlay staleness:
#   @acme/standards overlay for "no-console-log"
#   - Upstream changed severity: warning → error
#   - Your overlay: severity error (now matches upstream)
#   - Recommendation: Remove overlay (redundant)
#
# Expired overlays:
#   @acme/standards overlay for "no-deprecated-api"
#   - Expires: 2025-10-15 (30 days ago)
#   - Recommendation: Review and update or remove
```

See `docs/drift-detection.md` for full drift capabilities.

---

## CLI Commands

### Add Overlay

```bash
# Interactive mode
aln override add

# Direct mode
aln override add \
  --pack @acme/standards \
  --check no-console-log \
  --severity error

# With metadata
aln override add \
  --pack @acme/standards \
  --check max-complexity \
  --input threshold=15 \
  --reason "Backend migration" \
  --expires 2025-12-31 \
  --owner backend-team
```

### View Overlays

```bash
# Dashboard of all overlays
aln override status

# Filter by pack
aln override status --pack @acme/standards

# Show only stale/expired
aln override status --stale
```

### Diff Overlays

```bash
# Three-way diff for specific check
aln override diff no-console-log

# Show all conflicts
aln override diff --conflicts
```

### Remove Overlay

```bash
# Interactive removal
aln override remove

# Direct removal
aln override remove \
  --pack @acme/standards \
  --check no-console-log
```

### Integration with Other Commands

```bash
# Update with conflict detection
aln update --safe

# Check with overlay validation
aln check --validate-overlays

# Sync with overlay application
aln sync  # Overlays applied automatically
```

See `docs/commands.md` for complete CLI reference.

---

## Examples

### Example 1: Severity Adjustment

**Scenario:** Upstream pack is too strict for your legacy codebase.

```yaml
# .aligntrue.yaml
sources:
  - git: https://github.com/acme/standards
    ref: v2.0.0
    path: packs/strict.yaml

overlays:
  # Downgrade all errors to warnings during migration
  - selector:
      source_pack: "@acme/standards"
      severity: error
    override:
      severity: warning
    metadata:
      reason: "Legacy codebase migration"
      expires: "2025-12-31"
```

### Example 2: Scope-Specific Rules

**Scenario:** Different rules for production vs test code.

```yaml
overlays:
  # Strict in production
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-any-type"
      scope: "src/**"
    override:
      severity: error

  # Relaxed in tests
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-any-type"
      scope: "tests/**"
    override:
      severity: off
```

### Example 3: Input Customization

**Scenario:** Customize complexity threshold for your project.

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "max-complexity"
    override:
      inputs:
        threshold: 15 # Default is 10
        excludeComments: true
```

### Example 4: Disable Autofix

**Scenario:** Keep check but disable risky autofix.

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "prefer-const"
    override:
      autofix: false
    metadata:
      reason: "Autofix conflicts with reactive framework"
```

---

## Best Practices

### Keep Overlays Minimal

Only override what you must. Fewer overlays = easier updates.

❌ **Bad:** Override many checks:

```yaml
overlays:
  - selector: { check_id: "check-1" }
    override: { severity: error }
  - selector: { check_id: "check-2" }
    override: { severity: error }
  # ... 20 more overlays
```

✅ **Good:** Fork and customize:

```yaml
# Create your own pack based on upstream
# Maintain in your repo
```

### Document Reasons

Always explain why:

```yaml
overlays:
  - selector: { check_id: "no-console-log" }
    override: { severity: off }
    metadata:
      reason: "CLI tool requires console output"
      owner: "cli-team"
```

### Set Expiration Dates

For temporary overrides:

```yaml
overlays:
  - selector: { check_id: "new-rule" }
    override: { severity: warning }
    metadata:
      expires: "2025-12-31"
      reason: "Gradual rollout"
```

Use `aln override status --expired` to audit.

### Use Scopes Wisely

Target specific directories:

```yaml
# ✅ Good: Specific scope
overlays:
  - selector:
      scope: "legacy/**"
    override: { severity: warning }

# ❌ Bad: Too broad
overlays:
  - selector: {}  # Applies everywhere
    override: { severity: warning }
```

### Review Regularly

Audit overlays monthly:

```bash
# Check for stale overlays
aln override status --stale

# Review expired overlays
aln override status --expired

# Validate overlays still needed
aln drift
```

---

## Troubleshooting

### Overlay Not Applied

**Symptom:** Overlay defined but check still uses upstream settings.

**Diagnosis:**

```bash
aln override status
# Look for "Healthy: no" entries
```

**Common causes:**

1. Typo in `check_id` or `source_pack`
2. Check no longer exists in upstream
3. Selector too specific (no matches)

**Fix:** Run `aln check --validate-overlays` for detailed errors.

### Overlay Conflicts

**Symptom:** Multiple overlays target same check.

**Diagnosis:**

```bash
aln override diff <check-id>
# Shows all overlays targeting this check
```

**Fix:** Consolidate overlays or use more specific scopes.

### Update Breaks Overlays

**Symptom:** After `aln update`, overlays fail to apply.

**Diagnosis:**

```bash
aln update --dry-run
# Shows what would change

aln override status
# Shows health after update
```

**Fix:** Use `aln update --safe` for conflict detection and three-way merge.

See `docs/troubleshooting-overlays.md` for comprehensive troubleshooting.

---

## Related Documentation

- **Team Mode:** `docs/team-mode.md` - Overlay policies and approval workflows
- **Git Sources:** `docs/git-sources.md` - Pull packs with overlays
- **Drift Detection:** `docs/drift-detection.md` - Detect overlay staleness
- **Commands:** `docs/commands.md` - Complete CLI reference
- **Plugs:** `docs/plugs.md` - Agent-specific customization
- **Troubleshooting:** `docs/troubleshooting-overlays.md` - Common issues

---

## Summary

**Overlays let you customize without forking:**

1. **Quick:** Add overlay in 60 seconds
2. **Safe:** Preserve upstream updates
3. **Flexible:** Change severity, inputs, autofix
4. **Auditable:** Dashboard and drift detection
5. **Team-ready:** Approval policies and expiration tracking

**When in doubt:**

- Use **overlays** for pack-level customization (severity, inputs)
- Use **plugs** for agent-specific config (AI prompts, tool settings)
- **Fork** when you need fundamental changes

Start with overlays, graduate to forks only when necessary.
