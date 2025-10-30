# Invalid: Multiple Blocks in Same Section

This file demonstrates what NOT to do - multiple aligntrue blocks in a single section.

## Testing Rules

First block in testing section:

```aligntrue
id: testing.first
version: 0.1.0
spec_version: "1"
rules:
  - id: testing.require-tests
    severity: warn
    guidance: "Write tests"
```

Second block in the SAME section (invalid!):

```aligntrue
id: testing.second
version: 0.1.0
spec_version: "1"
rules:
  - id: testing.coverage
    severity: error
    guidance: "Maintain coverage"
```

This should fail validation with a clear error message.
