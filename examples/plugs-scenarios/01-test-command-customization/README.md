# Test Command Customization Scenario

**Keywords:** test command, different test runners, pytest vs jest, custom test command, project-specific testing

## Problem

You're using a shared rule pack that references `[[plug:test.cmd]]` but your project uses a specific test runner:

- Some projects use `pytest -q`
- Others use `pnpm test`
- Some use `cargo test`

You need to customize the test command without forking the pack.

## Solution

Use plugs to fill the test command slot:

```yaml
plugs:
  fills:
    test.cmd: "pnpm test"
```

The pack declares the slot:

```yaml
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "pytest -q"
```

## Configuration

See `.aligntrue/config.yaml` for the complete configuration.

## Expected Outcome

- Pack references `[[plug:test.cmd]]` in rules
- Your project fills it with `pnpm test`
- Exported rules contain the resolved command
- No pack forking required

## Testing

```bash
./test-scenario.sh
```

## Related Scenarios

- Organization metadata
- Stack-specific paths
