---
title: "Troubleshooting overlays"
description: "Fix overlay issues: not applied, stale selectors, ambiguous matches, or size limits."
---

# Troubleshooting overlays

Common issues when working with overlays and their solutions.

---

## Overlay not applied

**Symptom:** You defined an overlay but the check still uses upstream settings.

### Diagnosis

```bash
# Check overlay health
aln override status

# Look for issues
aln override status --stale
```

### Common causes

#### 1. Typo in Rule ID

**Problem:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-logs]" # Wrong: should be "no-console-log"
      set:
        severity: "error"
```

**Solution:**

```bash
# Find correct rule ID (inspect IR)
cat .aligntrue/ir.json | jq '.rules[].id'

# Fix overlay
aln override remove 'rule[id=no-console-logs]'
aln override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error
```

#### 2. Selector Doesn't Match

**Problem:** Selector doesn't match any rules in the IR.

**Error message:**

```
✗ Overlay validation failed

Selector matches no rules: rule[id=nonexistent-rule]

Hint: Check rule ID spelling and ensure rule exists in IR
```

**Solution:**

```bash
# List available rules (feature not implemented yet)
# For now, inspect IR directly:
cat .aligntrue/ir.json | jq '.rules[].id'

# Fix selector
aln override remove 'rule[id=nonexistent-rule]'
aln override add \
  --selector 'rule[id=correct-rule-id]' \
  --set severity=error
```

#### 3. Property Path Invalid

**Problem:**

```yaml
overlays:
  overrides:
    - selector: "nonexistent.property.path"
      set:
        value: "test"
```

**Result:** Selector doesn't match any property in IR.

**Solution:**

Inspect IR structure and use correct path:

```bash
# View IR structure
cat .aligntrue/ir.json | jq 'keys'

# Use correct property path
aln override add --selector 'profile.version' --set value="2.0.0"
```

#### 4. Check Removed from Upstream

**Problem:** Upstream pack removed or renamed the check.

**Diagnosis:**

```bash
aln override status

# Output:
# ❌ rule[id=old-rule-name]
#   Set: severity=error
#   Healthy: stale (no match in IR)
```

**Solution:**

```bash
# Remove stale overlay
aln override remove 'rule[id=old-rule-name]'

# Find new rule ID (inspect IR)
cat .aligntrue/ir.json | jq '.rules[].id'

# Add overlay with new rule ID
aln override add \
  --selector 'rule[id=new-rule-name]' \
  --set severity=error
```

---

## Overlay conflicts

**Symptom:** Multiple overlays target the same check or upstream changes conflict with overlay.

### Multiple overlays for same check

**Problem:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"

    - selector: "rule[id=no-console-log]"
      set:
        severity: "warning" # Conflicts with above
```

**Behavior:** Last matching overlay wins. The second overlay overrides the first.

**Solution (if unintended):**

```bash
# Remove duplicate overlay
aln override remove 'rule[id=no-console-log]'
# Choose which one to keep and re-add it
aln override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error
```

**Solution (if intended):**

Consolidate into single overlay:

```yaml
overlays:
  overrides:
    # Single overlay with desired severity
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

### Upstream changed same field

**Problem:** Upstream changed severity from `warning` to `error`, your overlay also sets `error`.

**Diagnosis:**

```bash
aln override diff 'rule[id=no-console-log]'

# Output shows:
# Original: severity=warning
# With overlay: severity=error
# (If upstream also changed to error, overlay is now redundant)
```

**Solution:**

Remove redundant overlay:

```bash
aln override remove 'rule[id=no-console-log]'

# Overlay no longer needed (upstream matches your preference)
```

### Three-Way Merge Conflict

**Problem:** Upstream changed field you didn't override, but your overlay now conflicts.

**Example:**

```yaml
# Original upstream
check:
  id: max-complexity
  severity: warning
  inputs:
    threshold: 10

# Your overlay (before upstream update)
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15

# Upstream update
check:
  id: max-complexity
  severity: error        # Changed
  inputs:
    threshold: 12        # Changed
    excludeComments: true # Added
```

**Result:** Your overlay still sets `threshold: 15`, but upstream changed to `12` and added `excludeComments`.

**Diagnosis:**

```bash
aln override diff 'rule[id=max-complexity]'

# Shows original vs overlayed result
```

**Solution options:**

**Option A:** Keep your overlay (ignore upstream input change):

```bash
# No action needed, overlay applies as-is
aln sync
```

**Option B:** Merge manually:

```bash
# Remove old overlay
aln override remove 'rule[id=max-complexity]'

# Add new overlay with merged inputs
aln override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15 \
  --set check.inputs.excludeComments=true
```

**Option C:** Accept upstream (remove overlay):

```bash
aln override remove 'rule[id=max-complexity]'
```

---

## Ambiguous selector

**Symptom:** Overlay matches multiple rules unintentionally.

### Selector matches multiple rules

**Problem:** Selector is ambiguous and matches more than one rule.

**Example:**

```yaml
overlays:
  overrides:
    # If multiple rules have same ID (from different sources)
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

**Result:** Overlay applies to all matching rules (may be unintended).

**Diagnosis:**

```bash
aln override status

# Output shows if overlay matches multiple rules
```

**Solution:**

Make selector more specific or accept that it applies to all matches. Currently, selectors apply to all matching rules. For more granular control, use property paths or array indices to target specific instances.

---

## Expired overlays

**Symptom:** Overlay has passed expiration date but still applies.

### How expiration works

**Key point:** Expiration is **advisory only**. Overlays continue to apply after expiration but show warnings.

**Diagnosis:**

```bash
aln override status

# Output:
# ⚠ rule[id=no-deprecated-api]
#   Set: severity=warning
#   Healthy: yes
#   Note: Check YAML comments for expiration tracking
```

**Solution:**

Review YAML comments and decide:

**Option A:** Extend expiration (update YAML comment):

```yaml
overlays:
  overrides:
    # TEMPORARY: Migration extended
    # Expires: 2025-12-31 (was 2025-10-15)
    - selector: "rule[id=no-deprecated-api]"
      set:
        severity: "warning"
```

**Option B:** Remove overlay:

```bash
# Migration complete, remove override
aln override remove 'rule[id=no-deprecated-api]'
```

**Option C:** Make permanent (update YAML comment):

```yaml
overlays:
  overrides:
    # PERMANENT: Legacy code exception
    # Owner: platform-team
    - selector: "rule[id=no-deprecated-api]"
      set:
        severity: "warning"
```

### Automated expiration audits

Add to CI:

```bash
# .github/workflows/validate.yml
- name: Check for expired overlays
  run: |
    aln override status --stale --json > stale-overlays.json
    if [ $(jq '.expired | length' stale-overlays.json) -gt 0 ]; then
      echo "⚠️  Expired overlays detected"
      jq '.expired' stale-overlays.json
      exit 1  # Fail CI
    fi
```

---

## Plug slot overlap

**Symptom:** Overlay and plug both try to customize same field.

### Problem example

**Overlay:**

```yaml
overlays:
  overrides:
    - selector: "rule[id=ai-prompt-template]"
      set:
        "check.inputs.context": "production code"
```

**Plug:**

```yaml
plugs:
  - id: "cursor-context"
    agent: cursor
    slots:
      context: "local development" # Conflicts with overlay
```

**Result:** Undefined behavior (plug or overlay may win depending on merge order).

### Diagnosis

```bash
# Check overlay status
aln override status

# Check plug status
aln plugs status

# Look for overlapping fields
```

### Solution

**Rule:** Overlays handle pack-level customization, plugs handle agent-specific config.

**Option A:** Use overlay for pack changes:

```yaml
# Remove plug slot
plugs:
  - id: "cursor-context"
    agent: cursor
    # Removed: slots.context

# Keep overlay (applies to all agents)
overlays:
  overrides:
    - selector: "rule[id=ai-prompt-template]"
      set:
        "check.inputs.context": "production code"
```

**Option B:** Use plug for agent-specific override:

```yaml
# Remove overlay
overlays:
  overrides: []

# Keep plug (Cursor-specific)
plugs:
  - id: "cursor-context"
    agent: cursor
    slots:
      context: "local development"
```

**Decision tree:**

- **Same value for all agents?** Use overlay
- **Agent-specific value?** Use plug
- **Both needed?** Pick one or redesign (avoid overlap)

---

## Overlay not validated in CI

**Symptom:** Overlay passes locally but fails in CI.

### Common causes

#### 1. Lockfile Drift

**Problem:** Local overlay applied but lockfile not committed.

**CI error:**

```
✗ Lockfile validation failed

Lockfile out of sync with rules
  - Overlay hash mismatch for @acme/standards

Hint: Run 'aln sync' locally and commit lockfile
```

**Solution:**

```bash
# Regenerate lockfile locally
aln sync

# Commit lockfile
git add .aligntrue.lock.json
git commit -m "chore: Update lockfile with overlay"
git push
```

#### 2. Team Mode Not Enabled in CI

**Problem:** Local has team mode, CI uses solo mode.

**Solution:**

Ensure CI config matches local:

```yaml
# .aligntrue/config.yaml (must be committed)
mode: team
modules:
  lockfile: true
  bundle: true
```

#### 3. Missing Source in CI

**Problem:** Overlay targets git source not pulled in CI.

**CI error:**

```
✗ Overlay validation failed

Pack not found: @acme/standards

Hint: Ensure git sources are pulled in CI
```

**Solution:**

Add source pull to CI:

```yaml
# .github/workflows/validate.yml
- name: Pull sources
  run: aln pull https://github.com/acme/standards --offline # Use cache

- name: Validate
  run: aln check --ci
```

Or vendor pack:

```bash
# Vendor pack (commit to repo)
git submodule add https://github.com/acme/standards vendor/acme-standards
aln link https://github.com/acme/standards --path vendor/acme-standards

# CI will have pack without network call
```

---

## When to Fork Instead

**Symptom:** You have many overlays or complex customizations.

### Indicators you should fork

❌ **Don't overlay if:**

- You have >5 overlays for same pack
- You're changing check logic (not just severity/inputs)
- You need to add new checks
- Upstream updates are irrelevant to you
- Your requirements diverge fundamentally

✅ **Fork instead:**

```bash
# Clone upstream pack
git clone https://github.com/acme/standards my-standards

# Customize freely
cd my-standards
# Edit .aligntrue.yaml with your changes

# Vendor in your project
cd /path/to/your/project
git submodule add https://github.com/yourorg/my-standards vendor/my-standards
aln link https://github.com/yourorg/my-standards --path vendor/my-standards
```

### Hybrid approach

Fork for major changes, overlay for minor tweaks:

```yaml
# Use your fork as base
sources:
  - git: https://github.com/yourorg/my-standards
    path: vendor/my-standards

# Overlay minor adjustments
overlays:
  overrides:
    # TEMPORARY: Migration strictness
    # Expires: 2025-12-31
    - selector: "rule[id=specific-check]"
      set:
        severity: "error"
```

---

## Debug commands

### Inspect overlay application

```bash
# Show all overlays
aln override status

# Show overlay for specific rule
aln override diff 'rule[id=no-console-log]'

# JSON output for scripting
aln override status --json | jq '.overlays[] | select(.healthy == false)'
```

### Validate overlays

```bash
# Validate overlay application
aln override status

# Dry-run sync to see effects
aln sync --dry-run

# Check drift (includes overlay drift)
aln drift
```

### Inspect lockfile

```bash
# View overlay hashes in lockfile
cat .aligntrue.lock.json | jq '.dependencies[] | {pack: .id, overlay_hash: .overlay_hash}'

# Compare overlay hash between runs
git diff .aligntrue.lock.json
```

---

## Common error messages

### "Overlay validation failed: Selector matches no rules"

**Cause:** Selector doesn't match any rules in IR.

**Fix:**

```bash
# List available rules (inspect IR)
cat .aligntrue/ir.json | jq '.rules[].id'

# Update overlay with correct selector
aln override remove 'rule[id=wrong-id]'
aln override add \
  --selector 'rule[id=correct-id]' \
  --set severity=error
```

### "Overlay validation failed: Invalid selector syntax"

**Cause:** Selector syntax is incorrect.

**Fix:**

```bash
# Check selector format
# Valid formats:
# - 'rule[id=value]' (quotes required)
# - property.path
# - array[0]

# Update overlay with correct syntax
aln override add \
  --selector 'rule[id=correct-format]' \
  --set severity=error
```

### "Overlay conflict: Duplicate selector"

**Cause:** Multiple overlays have identical selectors.

**Fix:**

```bash
# View all overlays
aln override status

# Remove duplicate (interactive)
aln override remove
```

### "Lockfile drift detected: Overlay hash mismatch"

**Cause:** Overlay changed but lockfile not updated.

**Fix:**

```bash
# Regenerate lockfile
aln sync

# Commit lockfile
git add .aligntrue.lock.json
git commit -m "chore: Update lockfile"
```

---

## Best practices to avoid issues

### 1. Use Specific Selectors

```yaml
# ✅ Good: Specific rule ID
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"

# ❌ Bad: Too vague (if property path is ambiguous)
overlays:
  overrides:
    - selector: "severity"  # Might match multiple properties
      set:
        value: "warning"
```

### 2. Document Reasons

```yaml
# ✅ Good: Clear reason with YAML comments
overlays:
  overrides:
    # CLI tool requires console output for user feedback
    # Owner: cli-team
    - selector: "rule[id=no-console-log]"
      set:
        severity: "off"

# ❌ Bad: No context
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "off"
```

### 3. Set Expiration for Temporary Overrides

```yaml
# ✅ Good: Expires after migration
overlays:
  overrides:
    # TEMPORARY: Gradual rollout
    # Expires: 2025-12-31
    - selector: "rule[id=new-security-rule]"
      set:
        severity: "warning"

# ❌ Bad: No expiration (forgotten override)
overlays:
  overrides:
    - selector: "rule[id=new-security-rule]"
      set:
        severity: "warning"
```

### 4. Audit Regularly

```bash
# Monthly audit
aln override status

# Check for redundant overlays
aln override diff

# Validate in CI
aln drift
```

### 5. Use Dot Notation for Nested Properties

```yaml
# ✅ Good: Dot notation for nested properties
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15
        "check.inputs.excludeComments": true

# ❌ Bad: Won't work (overlays don't support nested objects in set)
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        check:
          inputs:
            threshold: 15
```

---

## Related documentation

- **Overlays Guide:** `docs/overlays.md` - Complete overlay documentation
- **Commands:** `docs/commands.md` - CLI reference for overlay commands
- **Drift Detection:** `docs/drift-detection.md` - Automated staleness checks
- **Team Mode:** `docs/team-mode.md` - Team approval workflows
- **Git Sources:** `docs/git-sources.md` - Working with upstream packs

---

## Still having issues?

1. **Check lockfile:** `cat .aligntrue.lock.json | jq '.dependencies[] | select(.overlay_hash != null)'`
2. **Validate overlays:** `aln check --validate-overlays`
3. **Review drift:** `aln drift --json | jq '.categories.overlay_staleness'`
4. **Inspect health:** `aln override status --stale`

If none of these resolve the issue, file a bug report with:

- Output of `aln override status`
- Contents of `.aligntrue.yaml` (overlays section)
- Lockfile excerpt (if team mode)
- Expected vs actual behavior
