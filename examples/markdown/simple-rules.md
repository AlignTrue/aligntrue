# Simple AlignTrue Rules

This is an example of literate markdown authoring for AlignTrue rules.

```aligntrue
id: simple-rules
version: 0.1.0
spec_version: "1"
rules:
  - id: testing-require-tests
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
    guidance: |
      All features must have tests to ensure reliability.
      Write tests alongside your code, not as an afterthought.
    tags:
      - testing
      - quality
    vendor:
      cursor:
        ai_hint: "Suggest test scaffolding with vitest"
  
  - id: docs-update-readme
    severity: info
    applies_to:
      - "README.md"
    guidance: |
      Keep the README up to date with any significant changes.
      A good README helps onboarding and reduces support burden.
    tags:
      - documentation
    vendor:
      cursor:
        ai_hint: "Remind to update README when features change"
```

## Testing Rules

All features should have comprehensive tests. This ensures reliability and makes refactoring safer.

## Documentation

Documentation is crucial for maintainability. Keep your docs current and helpful.

