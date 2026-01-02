---
title: Overlay issues
description: Fix overlay issues - not applied, stale selectors, conflicts, or validation problems
---

# Overlay issues

Common issues when working with overlays and their solutions.

## Overlay not applied

**Symptom:** You defined an overlay but the check still uses upstream settings.

### Diagnosis

```bash
# Apply overlays and rebuild IR/exports (conflicts now fail by default)
aligntrue sync
# Output shows: ✓ Applied N overlays (or errors if conflicts/deprecated selectors)

# Confirm selector health against the current IR
aligntrue override

# Inspect the change the overlay applies
aligntrue override diff 'rule[id=your-rule-id]'

# Look for issues
aligntrue override --json
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
# Find correct rule ID
aligntrue override selectors

# Fix overlay
aligntrue override remove 'rule[id=no-console-logs]'
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error
```

#### 2. Selector doesn't match

**Problem:** Selector doesn't match any rules in the IR, or uses a deprecated selector type. Supported selectors: `rule[id=...]`, `sections[index]`.

**Error message:**

```
✗ Overlay validation failed

Selector matches no rules: rule[id=nonexistent-rule]

Hint: Check rule ID spelling and ensure rule exists in IR
```

**Solution:**

```bash
# List available selectors
aligntrue override selectors

# Fix selector
aligntrue override remove 'rule[id=nonexistent-rule]'
aligntrue override add \
  --selector 'rule[id=correct-rule-id]' \
  --set severity=error
```

#### 3. Check removed from upstream

**Problem:** Upstream align removed or renamed the check.

**Diagnosis:**

```bash
aligntrue override status

# Output:
# ❌ rule[id=old-rule-name]
#   Set: severity=error
#   Healthy: stale (no match in IR)
```

**Solution:**

```bash
# Remove stale overlay
aligntrue override remove 'rule[id=old-rule-name]'

# Find new rule ID
aligntrue override selectors

# Add overlay with new rule ID
aligntrue override add \
  --selector 'rule[id=new-rule-name]' \
  --set severity=error
```

## Overlay conflicts

**Default:** Conflicts now fail sync. If multiple overlays target the same property, `aligntrue sync` exits with errors.

**Allow conflicts (last-writer-wins):**

```bash
aligntrue sync --allow-overlay-conflicts
```

or in config:

```yaml
overlays:
  allow_overlay_conflicts: true
```

**Fix conflicts (recommended):**

1. Remove duplicate/overlapping overlays so each property is set once.
2. Prefer `rule[id=...]` selectors for clarity.

## Overlay status

**Symptom:** Overlays don't seem to be taking effect.

### Verify overlays are active (and conflict-free)

```bash
# 1. Apply overlays (required for IR/exports)
aligntrue sync
# Output shows: ✓ Applied N overlays

# 2. Check that overlay is active and healthy
aligntrue override status
# Shows: ✓ rule[id=your-rule-id]
#        Set: severity="error"
#        Healthy: yes

# 3. View the effect of the overlay in IR
aligntrue override diff 'rule[id=your-rule-id]'
# Shows: Original → Modified with overlay applied
```

### Overlay effects not visible in exports

If you don't see severity changes in AGENTS.md or other exports, this is **expected**. Here's why:

- **Overlays apply at sync time:** `.aligntrue/rules/` stays upstream; overlays modify the in-memory IR during `aligntrue sync`
- **Exports are simplified:** Markdown exports may omit some fields for readability
- **Behavior is affected:** Checks use the modified IR behavior
- **Verification:** Run `aligntrue sync` (look for "Applied N overlays"), then use `aligntrue override status` and `aligntrue override diff` to confirm

## Quick commands

### Add overlay

```bash
# Change severity
aligntrue override add \
  --selector 'rule[id=no-console-log]' \
  --set severity=error

# Modify nested property (dot notation)
aligntrue override add \
  --selector 'rule[id=max-complexity]' \
  --set check.inputs.threshold=15

# Remove property
aligntrue override add \
  --selector 'rule[id=prefer-const]' \
  --remove autofix

# Combined set and remove
aligntrue override add \
  --selector 'rule[id=line-length]' \
  --set severity=warning \
  --set check.inputs.max=120 \
  --remove autofix
```

### View overlays

```bash
# Dashboard of all overlays
aligntrue override status

# JSON output for CI
aligntrue override status --json

# List available selectors
aligntrue override selectors
```

### Diff overlays

```bash
# Show effect of specific overlay
aligntrue override diff 'rule[id=no-console-log]'

# Show all overlay effects
aligntrue override diff
```

### Remove overlay

```bash
# Interactive removal (select from list)
aligntrue override remove

# Direct removal by selector
aligntrue override remove 'rule[id=no-console-log]'

# Skip confirmation
aligntrue override remove 'rule[id=no-console-log]' --force
```

## Best practices

### Document reasons

Always explain why using YAML comments in config:

```yaml
overlays:
  overrides:
    # CLI tool requires console output for user feedback
    # Owner: cli-team
    - selector: "rule[id=no-console-log]"
      set:
        severity: "off"
```

### Track temporary overlays

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

Use `aligntrue override status` to review active overlays regularly.

### Review regularly

Audit overlays monthly:

```bash
# Check all overlays health
aligntrue override status

# View overlay effects
aligntrue override diff

# Detect drift
aligntrue drift
```

## Related documentation

- [Overlays Guide](/docs/02-customization/overlays) - Complete overlay documentation
- [CLI Reference](/docs/04-reference/cli-reference) - Command details
- [Team Mode Guide](/docs/03-concepts/team-mode) - Team workflows with overlays
- [Drift Detection](/docs/03-concepts/drift-detection) - Detect overlay staleness

## Still having issues?

1. Run `aligntrue override status` to check health
2. Run `aligntrue override diff` to see current effects
3. Review drift with `aligntrue drift`
4. Check the [Overlays Guide](/docs/02-customization/overlays) for complete documentation

If none of these resolve your issue, check the main [Troubleshooting guide](/docs/05-troubleshooting) or open an issue on [GitHub](https://github.com/AlignTrue/aligntrue/issues).
