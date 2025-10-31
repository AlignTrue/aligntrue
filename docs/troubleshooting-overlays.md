# Troubleshooting Overlays

**Status:** Stable (Phase 3.5)

Common issues when working with overlays and their solutions.

---

## Overlay Not Applied

**Symptom:** You defined an overlay but the check still uses upstream settings.

### Diagnosis

```bash
# Check overlay health
aln override status

# Look for issues
aln override status --stale
```

### Common Causes

#### 1. Typo in Check ID

**Problem:**

```yaml
overlays:
  - selector:
      check_id: "no-console-logs" # Wrong: should be "no-console-log"
    override:
      severity: error
```

**Solution:**

```bash
# Find correct check ID
aln check --list-checks

# Or inspect pack directly
cat vendor/acme-standards/.aligntrue.yaml | grep "id:"

# Fix overlay
aln override remove --check no-console-logs
aln override add --check no-console-log --severity error
```

#### 2. Pack Not Found

**Problem:**

```yaml
overlays:
  - selector:
      source_pack: "@acme/standarsd" # Typo in pack name
    override:
      severity: error
```

**Error message:**

```
✗ Overlay validation failed

Pack not found: @acme/standarsd

Available packs:
  - @acme/standards
  - @acme/security

Hint: Check spelling and ensure pack is in config
```

**Solution:**

```bash
# List available packs
aln scopes

# Fix typo
aln override remove --pack @acme/standarsd
aln override add --pack @acme/standards --severity error
```

#### 3. Selector Too Specific

**Problem:**

```yaml
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-console-log"
      scope: "src/utils/**" # Too narrow, check applies to "src/**"
    override:
      severity: error
```

**Result:** Overlay only applies to `src/utils/**` but check runs in all of `src/`, so most violations use upstream severity.

**Solution:**

Widen scope or remove scope selector:

```bash
# Remove overly specific overlay
aln override remove --check no-console-log --scope "src/utils/**"

# Add broader overlay
aln override add \
  --pack @acme/standards \
  --check no-console-log \
  --scope "src/**" \
  --severity error
```

#### 4. Check Removed from Upstream

**Problem:** Upstream pack removed or renamed the check.

**Diagnosis:**

```bash
aln override status --stale

# Output:
# ❌ @acme/standards → old-check-name
#   Healthy: stale (check not found in upstream)
```

**Solution:**

```bash
# Remove stale overlay
aln override remove --check old-check-name

# Find new check name
aln check --list-checks

# Add overlay with new check ID
aln override add --check new-check-name --severity error
```

---

## Overlay Conflicts

**Symptom:** Multiple overlays target the same check or upstream changes conflict with overlay.

### Multiple Overlays for Same Check

**Problem:**

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
      severity: warning # Conflicts with above
```

**Behavior:** Most specific selector wins (check_id + scope > check_id). The second overlay overrides the first for `src/**`.

**Solution (if unintended):**

```bash
# Remove less specific overlay
aln override remove --check no-console-log

# Keep only scope-specific overlay
# (Second overlay remains)
```

**Solution (if intended):**

Keep both. Document precedence:

```yaml
overlays:
  # Default: error everywhere
  - selector:
      check_id: "no-console-log"
    override:
      severity: error
    metadata:
      reason: "Strict by default"

  # Exception: warning in src/ (more specific, wins)
  - selector:
      check_id: "no-console-log"
      scope: "src/**"
    override:
      severity: warning
    metadata:
      reason: "Legacy code has console.log usage"
```

### Upstream Changed Same Field

**Problem:** Upstream changed severity from `warning` to `error`, your overlay also sets `error`.

**Diagnosis:**

```bash
aln override diff no-console-log

# Output shows:
# Upstream changed: warning → error
# Your overlay: error
# Result: error (redundant overlay)
```

**Solution:**

Remove redundant overlay:

```bash
aln override remove --check no-console-log

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
  - selector:
      check_id: max-complexity
    override:
      inputs:
        threshold: 15

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
aln override diff max-complexity

# Shows three-way diff with merge result
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
aln override remove --check max-complexity

# Add new overlay with merged inputs
aln override add \
  --check max-complexity \
  --input threshold=15 \
  --input excludeComments=true \
  --reason "Use upstream excludeComments, keep our threshold"
```

**Option C:** Accept upstream (remove overlay):

```bash
aln override remove --check max-complexity
```

---

## Ambiguous Selector

**Symptom:** Overlay matches multiple checks unintentionally.

### Multiple Packs Have Same Check ID

**Problem:**

```yaml
# Both packs define "no-console-log"
sources:
  - git: https://github.com/acme/standards
  - git: https://github.com/acme/security

overlays:
  - selector:
      check_id: "no-console-log" # Ambiguous!
    override:
      severity: error
```

**Result:** Overlay applies to both checks (may be unintended).

**Diagnosis:**

```bash
aln override status

# Output shows overlay applies to multiple packs:
# ✓ @acme/standards → no-console-log (severity: error)
# ✓ @acme/security → no-console-log (severity: error)
```

**Solution:**

Add `source_pack` to disambiguate:

```bash
# Remove ambiguous overlay
aln override remove --check no-console-log

# Add specific overlay
aln override add \
  --pack @acme/standards \
  --check no-console-log \
  --severity error

# Optionally add second overlay for other pack
aln override add \
  --pack @acme/security \
  --check no-console-log \
  --severity warning
```

---

## Expired Overlays

**Symptom:** Overlay has passed expiration date but still applies.

### How Expiration Works

**Key point:** Expiration is **advisory only**. Overlays continue to apply after expiration but show warnings.

**Diagnosis:**

```bash
aln override status --stale

# Output:
# ⚠ @acme/standards → no-deprecated-api
#   Expires: 2025-10-15 (EXPIRED 30 days ago)
#   Healthy: expired
```

**Solution:**

Review and decide:

**Option A:** Extend expiration:

```bash
# Remove old overlay
aln override remove --check no-deprecated-api

# Add with new expiration
aln override add \
  --check no-deprecated-api \
  --severity warning \
  --expires 2025-12-31 \
  --reason "Migration extended"
```

**Option B:** Remove overlay:

```bash
# Migration complete, remove override
aln override remove --check no-deprecated-api
```

**Option C:** Make permanent (remove expiration):

```bash
# Remove old overlay
aln override remove --check no-deprecated-api

# Add without expiration
aln override add \
  --check no-deprecated-api \
  --severity warning \
  --reason "Permanent exception for legacy code"
```

### Automated Expiration Audits

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

## Plug Slot Overlap

**Symptom:** Overlay and plug both try to customize same field.

### Problem Example

**Overlay:**

```yaml
overlays:
  - selector:
      check_id: "ai-prompt-template"
    override:
      inputs:
        context: "production code"
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
  - selector:
      check_id: "ai-prompt-template"
    override:
      inputs:
        context: "production code"
```

**Option B:** Use plug for agent-specific override:

```yaml
# Remove overlay
# overlays: []

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

## Overlay Not Validated in CI

**Symptom:** Overlay passes locally but fails in CI.

### Common Causes

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

### Indicators You Should Fork

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

### Hybrid Approach

Fork for major changes, overlay for minor tweaks:

```yaml
# Use your fork as base
sources:
  - git: https://github.com/yourorg/my-standards
    path: vendor/my-standards

# Overlay minor adjustments
overlays:
  - selector:
      source_pack: "@yourorg/my-standards"
      check_id: "specific-check"
    override:
      severity: error
    metadata:
      reason: "Temporary strictness for migration"
      expires: "2025-12-31"
```

---

## Debug Commands

### Inspect Overlay Application

```bash
# Show all overlays
aln override status

# Show overlay for specific check
aln override diff <check-id>

# Show only stale/expired
aln override status --stale

# JSON output for scripting
aln override status --json | jq '.overlays[] | select(.healthy == false)'
```

### Validate Overlays

```bash
# Validate overlay selectors
aln check --validate-overlays

# Dry-run sync to see overlay effects
aln sync --dry-run

# Check drift (includes overlay staleness)
aln drift
```

### Inspect Lockfile

```bash
# View overlay hashes in lockfile
cat .aligntrue.lock.json | jq '.dependencies[] | {pack: .id, overlay_hash: .overlay_hash}'

# Compare overlay hash between runs
git diff .aligntrue.lock.json
```

---

## Common Error Messages

### "Overlay validation failed: Pack not found"

**Cause:** Pack ID in overlay doesn't match any configured source.

**Fix:**

```bash
# List available packs
aln scopes

# Update overlay with correct pack ID
aln override remove --pack <wrong-id>
aln override add --pack <correct-id> --check <check-id> --severity <level>
```

### "Overlay validation failed: Check not found"

**Cause:** Check ID doesn't exist in target pack.

**Fix:**

```bash
# List checks in pack
aln check --list-checks --pack <pack-id>

# Update overlay with correct check ID
aln override remove --check <wrong-id>
aln override add --check <correct-id> --severity <level>
```

### "Overlay conflict: Multiple overlays match"

**Cause:** Multiple overlays have identical selectors.

**Fix:**

```bash
# View all overlays
aln override status

# Remove duplicate
aln override remove --check <check-id>  # Interactive mode to choose which one
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

## Best Practices to Avoid Issues

### 1. Use Specific Selectors

```yaml
# ✅ Good: Specific
overlays:
  - selector:
      source_pack: "@acme/standards"
      check_id: "no-console-log"
    override:
      severity: error

# ❌ Bad: Too broad
overlays:
  - selector: {}  # Matches everything
    override:
      severity: warning
```

### 2. Document Reasons

```yaml
# ✅ Good: Clear reason
overlays:
  - selector:
      check_id: "no-console-log"
    override:
      severity: off
    metadata:
      reason: "CLI tool requires console output"
      owner: "cli-team"

# ❌ Bad: No context
overlays:
  - selector:
      check_id: "no-console-log"
    override:
      severity: off
```

### 3. Set Expiration for Temporary Overrides

```yaml
# ✅ Good: Expires after migration
overlays:
  - selector:
      check_id: "new-security-rule"
    override:
      severity: warning
    metadata:
      expires: "2025-12-31"
      reason: "Gradual rollout"

# ❌ Bad: No expiration (forgotten override)
overlays:
  - selector:
      check_id: "new-security-rule"
    override:
      severity: warning
```

### 4. Audit Regularly

```bash
# Monthly audit
aln override status --stale

# Check for redundant overlays
aln override diff <check-id>

# Validate in CI
aln check --validate-overlays
```

### 5. Prefer Narrow Scopes

```yaml
# ✅ Good: Specific directory
overlays:
  - selector:
      check_id: "no-any-type"
      scope: "tests/**"
    override:
      severity: off

# ❌ Bad: Too broad
overlays:
  - selector:
      check_id: "no-any-type"
    override:
      severity: off
```

---

## Related Documentation

- **Overlays Guide:** `docs/overlays.md` - Complete overlay documentation
- **Commands:** `docs/commands.md` - CLI reference for overlay commands
- **Drift Detection:** `docs/drift-detection.md` - Automated staleness checks
- **Team Mode:** `docs/team-mode.md` - Team approval workflows
- **Git Sources:** `docs/git-sources.md` - Working with upstream packs

---

## Still Having Issues?

1. **Check lockfile:** `cat .aligntrue.lock.json | jq '.dependencies[] | select(.overlay_hash != null)'`
2. **Validate overlays:** `aln check --validate-overlays`
3. **Review drift:** `aln drift --json | jq '.categories.overlay_staleness'`
4. **Inspect health:** `aln override status --stale`

If none of these resolve the issue, file a bug report with:

- Output of `aln override status`
- Contents of `.aligntrue.yaml` (overlays section)
- Lockfile excerpt (if team mode)
- Expected vs actual behavior
