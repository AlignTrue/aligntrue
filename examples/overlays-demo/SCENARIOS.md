# Overlay scenarios

Detailed scenarios demonstrating overlay use cases with expected outputs.

## Scenario 1: Upgrade severity (warn → error)

### Use case

Team wants stricter enforcement than upstream default. Upstream pack has `no-console-log` as warning, but team policy requires error.

### Upstream rule

```yaml
- id: no-console-log
  summary: Avoid console.log in production code
  severity: warn # Upstream default
```

### Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error" # Team policy: stricter
```

### Result

After applying overlay:

- Rule severity changes from `warn` → `error`
- CI now fails instead of warning
- Team gets stricter enforcement without forking

### Commands

```bash
# View overlay status
aligntrue override status

# Output:
# Overlays (3 active)
#
# ✓ rule[id=no-console-log]
#   Set: severity=error
#   Status: Applied

# View before/after
aligntrue override diff 'rule[id=no-console-log]'

# Output shows:
# - severity: warn
# + severity: error
```

## Scenario 2: Adjust check inputs

### Use case

Project needs different complexity threshold than upstream default. Upstream sets threshold at 10, but project has complex domain logic requiring 15.

### Upstream rule

```yaml
- id: max-complexity
  summary: Limit cyclomatic complexity
  severity: error
  check:
    inputs:
      threshold: 10 # Upstream default
      excludeComments: false
```

### Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        "check.inputs.threshold": 15 # Project needs higher
        "check.inputs.excludeComments": true
```

### Result

After applying overlay:

- Threshold increases from 10 → 15
- Comments excluded from complexity calculation
- Project gets appropriate threshold without forking

### Commands

```bash
# View overlay status
aligntrue override status

# Output:
# ✓ rule[id=max-complexity]
#   Set: check.inputs.threshold=15, check.inputs.excludeComments=true
#   Status: Applied

# View before/after
aligntrue override diff 'rule[id=max-complexity]'

# Output shows:
# - threshold: 10
# + threshold: 15
# - excludeComments: false
# + excludeComments: true
```

## Scenario 3: Remove autofix

### Use case

Autofix conflicts with framework behavior. Upstream enables autofix for `prefer-const`, but it conflicts with React hooks dependencies. Keep check but disable autofix.

### Upstream rule

```yaml
- id: prefer-const
  summary: Use const for variables that are never reassigned
  severity: warn
  autofix:
    enabled: true # Upstream enables autofix
    description: "Replace let with const"
```

### Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=prefer-const]"
      remove:
        - "autofix" # Remove entire autofix property
```

### Result

After applying overlay:

- Autofix property removed
- Check still runs and reports violations
- Manual fixes only (no automatic changes)

### Commands

```bash
# View overlay status
aligntrue override status

# Output:
# ✓ rule[id=prefer-const]
#   Remove: autofix
#   Status: Applied

# View before/after
aligntrue override diff 'rule[id=prefer-const]'

# Output shows:
# - autofix:
# -   enabled: true
# -   description: "Replace let with const"
```

## Scenario 4: Temporary override during migration

### Use case

Team is migrating to new API. Temporarily downgrade severity during migration, then restore after completion.

### Week 1: Disable rule

```yaml
overlays:
  overrides:
    # TEMPORARY: Migration to new API in progress
    # Expires: 2025-12-31
    # Owner: platform-team
    - selector: "rule[id=no-deprecated-api]"
      set:
        severity: "off"
```

### Week 2: Enable as warning

```yaml
overlays:
  overrides:
    # TEMPORARY: Migration in progress, reviewing violations
    # Expires: 2025-12-31
    - selector: "rule[id=no-deprecated-api]"
      set:
        severity: "warn"
```

### Week 3: Remove overlay (use upstream default)

```yaml
overlays:
  overrides: [] # Migration complete, use upstream default (error)
```

## Scenario 5: Multiple overlays on same rule

### Use case

Combine multiple customizations on a single rule.

### Overlay

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        severity: "warning" # Downgrade from error
        "check.inputs.threshold": 15 # Increase threshold
        "check.inputs.excludeComments": true # Exclude comments
      remove:
        - "autofix" # Remove autofix
```

### Result

Single overlay applies multiple changes:

- Severity: error → warning
- Threshold: 10 → 15
- Exclude comments: false → true
- Autofix: removed

## Overlay health checks

### Check all overlays

```bash
aligntrue override status

# Output:
# Overlays (3 active, 0 stale)
#
# ✓ rule[id=no-console-log]
#   Set: severity=error
#   Healthy: yes
#
# ✓ rule[id=max-complexity]
#   Set: check.inputs.threshold=15, check.inputs.excludeComments=true
#   Healthy: yes
#
# ✓ rule[id=prefer-const]
#   Remove: autofix
#   Healthy: yes
```

### Detect stale overlays

If upstream removes or renames a rule, overlay becomes stale:

```bash
aligntrue override status

# Output:
# Overlays (2 active, 1 stale)
#
# ❌ rule[id=old-rule-name]
#   Set: severity=off
#   Healthy: stale (no match in IR)
#   Action: Remove overlay or update selector
```

## Best practices

### 1. Document reasons

Always explain why using comments:

```yaml
overlays:
  overrides:
    # Team policy: No console.log in production
    # Approved: 2025-10-15 by @team-lead
    # Reason: Enforce proper logging library usage
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

### 2. Track expiration

For temporary overrides:

```yaml
overlays:
  overrides:
    # TEMPORARY: Migration in progress
    # Expires: 2025-12-31
    # Owner: platform-team
    - selector: "rule[id=deprecated-api]"
      set:
        severity: "warn"
```

### 3. Review regularly

Monthly overlay audit:

```bash
# Check all overlays
aligntrue override status

# View effects
aligntrue override diff

# Remove stale overlays
aligntrue override remove 'rule[id=stale-rule]'
```

### 4. Keep overlays minimal

Only override what you must. Too many overlays suggest you should fork instead.

**Good:** 2-3 overlays for specific needs
**Bad:** 20+ overlays changing most rules → fork instead
