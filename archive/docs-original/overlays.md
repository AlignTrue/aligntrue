# Overlays guide

Overlays let you customize third-party packs without forking. Change severity, add check inputs, or remove autofix while preserving upstream updates.

---

## Quick start (60 seconds)

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
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
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

## Overlay anatomy

### Basic Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Change severity
```

### Advanced Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        severity: "warning"
        "check.inputs.threshold": 15 # Nested property with dot notation
        autofix: false # Disable autofix
```

**Note:** Metadata like `reason`, `expires`, and `owner` are not part of the overlay schema yet, but can be tracked via config comments or external documentation.

---

## Selector strategies

### By Rule ID

Applies to one specific rule by its unique ID:

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

**Use when:** Most rules are fine, one needs adjustment.

### By Property Path

Modify nested properties using dot notation:

```yaml
overlays:
  overrides:
    - selector: "profile.version"
      set:
        value: "2.0.0"
```

**Use when:** Changing configuration or metadata fields.

### By Array Index

Target specific array elements:

```yaml
overlays:
  overrides:
    - selector: "rules[0]"
      set:
        severity: "warn"
```

**Use when:** Modifying rules by position (less common, prefer rule ID).

**Note:** Scope-based selectors (e.g., `tests/**`) are not yet implemented. For now, overlays apply globally. You can track scope requirements separately and apply different overlays per directory by using hierarchical configs.

---

## Override capabilities

### Set Operation

Use `set` to modify properties (supports dot notation for nested paths):

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Simple property
        "check.inputs.maxLength": 120 # Nested property
        autofix: false # Disable autofix
```

**Severity values:** `"off"`, `"info"`, `"warning"`, `"error"`

### Remove Operation

Use `remove` to delete properties:

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      remove:
        - "autofix" # Remove autofix
        - "tags" # Remove tags array
```

### Combined Operations

Apply both set and remove in one overlay:

```yaml
overlays:
  overrides:
    - selector: "rule[id=line-length]"
      set:
        severity: "warning"
        "check.inputs.threshold": 120
      remove:
        - "autofix"
```

---

## Advanced patterns

### Multiple Overlays

Apply multiple overlays to different rules:

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"

    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15

    - selector: "rule[id=prefer-const]"
      remove:
        - "autofix"
```

**Order:** Overlays apply in definition order. Last matching overlay wins if multiple target the same rule.

### Temporary Overrides

Use YAML comments to track temporary overlays:

```yaml
overlays:
  overrides:
    # TEMPORARY: Migration to new API in progress
    # Expires: 2025-12-31
    # Owner: platform-team
    - selector: "rule[id=no-deprecated-api]"
      set:
        severity: "warning"
```

Use `aln override status` to review all active overlays.

### Migration Workflow

Gradually adopt stricter rules:

```yaml
# Week 1: Disable new check
overlays:
  overrides:
    - selector: "rule[id=new-security-rule]"
      set:
        severity: "off"

# Week 2: Enable as warning
overlays:
  overrides:
    - selector: "rule[id=new-security-rule]"
      set:
        severity: "warning"

# Week 3: Remove overlay (use upstream default: error)
overlays:
  overrides: []
```

---

## Conflict resolution

### What Causes Conflicts?

**Stale selectors:** Upstream renamed or removed a rule.

```yaml
# Upstream renamed "no-console-log" → "no-console-statements"
overlays:
  overrides:
    - selector: "rule[id=no-console-log]" # ❌ No longer exists
      set:
        severity: "error"
```

**Resolution:** Run `aln override status` to detect stale selectors, update to new rule ID.

**Duplicate overlays:** Multiple overlays target same rule.

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
    - selector: "rule[id=no-console-log]"
      set:
        severity: "warning" # ❌ Conflicts with above
```

**Resolution:** Last matching overlay wins. Consolidate into single overlay or remove duplicate.

### Handling Upstream Changes

When upstream changes may conflict with your overlay:

```bash
# Check overlay health after update
aln sync
aln override status
# Shows if overlays still match rules

# View overlay effects
aln override diff 'rule[id=no-console-log]'
# Shows: original IR → modified IR with overlay applied
```

**If rule ID changed upstream:**

1. Remove old overlay: `aln override remove 'rule[id=old-name]'`
2. Add new overlay: `aln override add --selector 'rule[id=new-name]' --set severity=error`

**If overlay now redundant (upstream matches your override):**

1. Verify match: `aln override diff`
2. Remove overlay: `aln override remove 'rule[id=rule-name]'`

---

## Team workflows

### Overlay Approval

Team mode tracks overlays in lockfile for review:

```json
// .aligntrue.lock.json
{
  "dependencies": {
    "acme-standards": {
      "content_hash": "sha256:upstream...",
      "overlay_hash": "sha256:local-mods...",
      "final_hash": "sha256:combined..."
    }
  }
}
```

See `docs/team-mode.md` for team mode workflows.

### Overlay Dashboard

Audit all overlays:

```bash
aln override status

# Output:
# Overlays (3 active, 1 stale)
#
# ✓ rule[id=no-console-log]
#   Set: severity=error
#   Healthy: yes
#
# ✓ rule[id=max-complexity]
#   Set: check.inputs.threshold=15
#   Healthy: yes
#
# ❌ rule[id=old-rule-name]
#   Set: severity=off
#   Healthy: stale (no match in IR)
```

---

## Overlay hashing and lockfile

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
      "base_hash": "sha256:upstream-content-hash",
      "overlay_hash": "sha256:overlay-modifications-hash",
      "result_hash": "sha256:combined-hash"
    }
  }
}
```

**base_hash:** Upstream pack content  
**overlay_hash:** Your overlay modifications  
**result_hash:** Combined result after overlays applied

### Drift Detection

Detect overlay staleness:

```bash
aln drift

# Output:
# Drift detected (2 categories)
#
# Overlay drift:
#   rule[id=no-console-log]
#   - overlay_hash changed (local modifications)
#   - Recommendation: Review overlay changes
#
# Upstream drift:
#   @acme/standards
#   - base_hash changed (upstream updated)
#   - Recommendation: Run aln sync to apply latest
```

See `docs/drift-detection.md` for full drift capabilities.

---

## CLI Commands

### Add Overlay

```bash
# Add overlay to change severity
aln override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# Add overlay with nested property (dot notation)
aln override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15

# Remove property
aln override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix

# Combined set and remove
aln override add \
  --selector 'rule[id=line-length]' \
  --set severity=warning \
  --set check.inputs.max=120 \
  --remove autofix
```

### View Overlays

```bash
# Dashboard of all overlays
aln override status

# JSON output for CI
aln override status --json
```

### Diff Overlays

```bash
# Show effect of specific overlay
aln override diff 'rule[id=no-console-log]'

# Show all overlay effects
aln override diff
```

### Remove Overlay

```bash
# Interactive removal (select from list)
aln override remove

# Direct removal by selector
aln override remove 'rule[id=no-console-log]'

# Skip confirmation
aln override remove 'rule[id=no-console-log]' --force
```

### Integration with Other Commands

```bash
# Sync applies overlays automatically
aln sync

# Update preserves overlays
aln update
```

See `docs/commands.md` for complete CLI reference.

---

## Examples

### Example 1: Severity Adjustment

**Scenario:** Upgrade warning to error for stricter enforcement.

```yaml
# .aligntrue.yaml
sources:
  - git: https://github.com/acme/standards
    ref: v2.0.0
    path: packs/strict.yaml

overlays:
  overrides:
    # TEMPORARY: Legacy codebase migration
    # Expires: 2025-12-31
    - selector: "rule[id=no-any-type]"
      set:
        severity: "error"
```

### Example 2: Input Customization

**Scenario:** Customize complexity threshold for your project.

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15 # Default is 10
        "check.inputs.excludeComments": true
```

### Example 3: Disable Autofix

**Scenario:** Keep check but disable risky autofix.

```yaml
overlays:
  overrides:
    # Autofix conflicts with reactive framework
    - selector: "rule[id=prefer-const]"
      remove:
        - "autofix"
```

### Example 4: Multiple Property Changes

**Scenario:** Change severity and add input configuration.

```yaml
overlays:
  overrides:
    - selector: "rule[id=line-length]"
      set:
        severity: "warning"
        "check.inputs.maxLength": 120
        "check.inputs.ignoreUrls": true
      remove:
        - "autofix"
```

---

## Best practices

### Keep Overlays Minimal

Only override what you must. Fewer overlays = easier updates.

❌ **Bad:** Override many rules:

```yaml
overlays:
  overrides:
    - selector: "rule[id=check-1]"
      set: { severity: "error" }
    - selector: "rule[id=check-2]"
      set: { severity: "error" }
    # ... 20 more overlays
```

✅ **Good:** Fork and customize:

```yaml
# Create your own pack based on upstream
# Maintain in your repo, or request changes upstream
```

### Document Reasons

Always explain why using YAML comments:

```yaml
overlays:
  overrides:
    # CLI tool requires console output for user feedback
    # Owner: cli-team
    - selector: "rule[id=no-console-log]"
      set:
        severity: "off"
```

### Track Expiration

For temporary overrides, use YAML comments:

```yaml
overlays:
  overrides:
    # TEMPORARY: Gradual rollout
    # Expires: 2025-12-31
    - selector: "rule[id=new-rule]"
      set:
        severity: "warning"
```

Use `aln override status` to review active overlays regularly.

### Review Regularly

Audit overlays monthly:

```bash
# Check all overlays health
aln override status

# View overlay effects
aln override diff

# Detect drift
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

**Fix:** Run `aln override status` for health status and detailed errors.

### Overlay Conflicts

**Symptom:** Multiple overlays target same rule.

**Diagnosis:**

```bash
aln override status
# Lists all active overlays
aln override diff
# Shows combined effect
```

**Fix:** Consolidate overlays into single definition. Last overlay wins if multiple target same rule.

### Update Breaks Overlays

**Symptom:** After `aln update`, overlays fail to apply.

**Diagnosis:**

```bash
aln override status
# Shows health after update

aln override diff
# Shows current effects
```

**Fix:** Update selectors to match new upstream rule IDs. Run `aln override remove` for stale overlays and re-add with correct selectors.

See `docs/troubleshooting-overlays.md` for comprehensive troubleshooting.

---

## Related documentation

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
