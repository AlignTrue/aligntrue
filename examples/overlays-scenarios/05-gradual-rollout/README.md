# Gradual Rollout Scenario

**Keywords:** progressive rule adoption, phased rollout, gradual enforcement, staged deployment

## Problem

You're rolling out new strict rules gradually:

- Week 1: New rules as info
- Week 2: Upgrade to warnings
- Week 3: Upgrade to errors
- Track rollout progress

## Solution

Use overlays to control rollout phase:

```yaml
overlays:
  overrides:
    # Phase 1: Info level (current)
    - selector: "rule[id=new-rule-1]"
      set:
        severity: "info"

    # Phase 2: Warning level (next week)
    # - selector: "rule[id=new-rule-1]"
    #   set:
    #     severity: "warn"

    # Phase 3: Error level (week after)
    # - selector: "rule[id=new-rule-1]"
    #   set:
    #     severity: "error"
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Rules rolled out gradually
- Team has time to adapt
- Clear progression path
- Easy to track phases

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Temporary migration
- Severity upgrade
