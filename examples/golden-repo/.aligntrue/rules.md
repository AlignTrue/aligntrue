# AlignTrue Rules

This file demonstrates AlignTrue's rule format with practical examples.

```aligntrue
id: golden-repo
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require.tests
    severity: error
    applies_to:
      - src/**/*.ts
      - src/**/*.tsx
    mode: always
    guidance: |-
      Every new feature must include unit tests. Test files should be co-located
      with source files using the .test.ts or .spec.ts naming convention.

      Examples:
      - src/utils/parser.ts → src/utils/parser.test.ts
      - src/components/Button.tsx → src/components/Button.test.tsx
  - id: code.review.no.todos
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
      - "**/*.js"
      - "**/*.jsx"
    mode: always
    guidance: |-
      TODO comments should be converted to GitHub issues before merging.
      They often get forgotten in the codebase.

      Instead of: // TODO: refactor this
      Do: Create issue, then // Issue #123: refactor this
  - id: docs.public.api
    severity: info
    applies_to:
      - src/**/index.ts
    mode: always
    guidance: |-
      Public API exports should include JSDoc comments explaining their purpose
      and usage. This helps with IDE intellisense and documentation generation.
  - id: security.no.secrets
    severity: error
    applies_to:
      - "**/*.ts"
      - "**/*.js"
      - "**/*.json"
      - "**/*.yaml"
    mode: always
    guidance: |-
      Never commit API keys, passwords, or tokens to version control.
      Use environment variables or secure secret management instead.

      Common patterns to avoid:
      - API_KEY = "sk_live_..."
      - password: "mypassword123"
      - token: "ghp_..."
  - id: typescript.no.any
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
    mode: always
    guidance: |-
      Avoid using 'any' type as it defeats TypeScript's type safety.
      Use 'unknown' for truly unknown types, or define proper interfaces.
    vendor:
      cursor:
        ai_hint: Suggest specific types based on usage context
        quick_fix: true
```
