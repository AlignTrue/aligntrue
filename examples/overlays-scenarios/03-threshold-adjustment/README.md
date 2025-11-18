# Threshold Adjustment Scenario

**Keywords:** complexity threshold, adjust limits, project-specific thresholds, tune parameters

## Problem

An upstream pack has complexity thresholds that don't fit your project:

- Upstream: `max-complexity` threshold is 10
- Your project: Legacy code needs threshold of 20
- New code: Keep threshold at 10

You need different thresholds without forking.

## Solution

Use overlays to adjust thresholds:

```yaml
overlays:
  overrides:
    - selector: "rule[id=max-complexity]"
      set:
        check.inputs.threshold: 20

    - selector: "rule[id=max-lines]"
      set:
        check.inputs.max: 500
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Complexity threshold adjusted for your project
- Line length limits customized
- Other rule parameters tuned
- No pack forking required

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Severity upgrade
- Temporary migration
