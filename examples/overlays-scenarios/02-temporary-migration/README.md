# Temporary Migration Scenario

**Keywords:** disable strict rules, temporary relaxation, during refactor, migration period, gradual adoption

## Problem

You're doing a major refactoring and need to temporarily disable strict rules:

- Normally: `strict-null-checks` is an error
- During migration: Downgrade to warning
- After migration: Restore to error

You want to track this as a temporary override.

## Solution

Use overlays to temporarily relax rules:

```yaml
overlays:
  overrides:
    - selector: "rule[id=strict-null-checks]"
      set:
        severity: "warn"
      # TODO: Remove after migration complete (2024-Q2)

    - selector: "rule[id=no-explicit-any]"
      set:
        severity: "warn"
      # TODO: Remove after migration complete (2024-Q2)
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Strict rules temporarily relaxed
- Migration can proceed without breaking CI
- Overrides documented with removal date
- Easy to restore strict rules later

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Severity upgrade
- Gradual rollout
