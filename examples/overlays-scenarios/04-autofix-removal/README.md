# Autofix Removal Scenario

**Keywords:** disable autofix, keep check but remove autofix, risky autofix, manual fix only

## Problem

An upstream rule has an autofix that's too aggressive for your codebase:

- Rule: `prefer-const` with autofix
- Problem: Autofix sometimes breaks code
- Solution: Keep the check but remove autofix

You want the warning but not the automatic changes.

## Solution

Use overlays to remove autofix:

```yaml
overlays:
  overrides:
    - selector: "rule[id=prefer-const]"
      remove: ["autofix"]

    - selector: "rule[id=no-var]"
      remove: ["autofix"]
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Rule still checks for issues
- Autofix removed from exports
- Manual fixes only
- Safer for complex codebases

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Severity upgrade
- Threshold adjustment
