# Severity Upgrade Scenario

**Keywords:** make warnings errors, upgrade severity, stricter rules, team standards, enforce warnings

## Problem

An upstream pack has a rule with `severity: warning` but your team wants to enforce it as an error:

- Upstream: `no-console-log` is a warning
- Your team: Should be an error in production code

You don't want to fork the pack just to change severity.

## Solution

Use overlays to upgrade severity:

```yaml
overlays:
  overrides:
    - selector: "rule[id=no-console-log]"
      set:
        severity: "error"
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Upstream pack unchanged
- Your exports show `severity: error`
- No pack forking required
- Easy to revert if needed

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Temporary migration
- Threshold adjustment
