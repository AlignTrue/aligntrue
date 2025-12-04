id: local-rules
version: 1.0.0
spec_version: "1"
sections:

- heading: Rules
  content: >

  # Multi-agent rules

  This file demonstrates rules with vendor bags for agent-specific
  customization.

  ````aligntrue

  id: multi-agent-demo

  version: "1.0.0"

  spec_version: "1"


  profile:
    id: example/multi-agent
    version: "1.0.0"

  rules:
    - id: require-tests
      summary: All features must have tests
      severity: error
      applies_to:
        patterns: ["src/**/*.ts", "src/**/*.tsx"]
      guidance: |
        Write unit tests for all new features.
        Test files should be co-located with source files.

        Examples:
        - src/utils/parser.ts → src/utils/parser.test.ts
        - src/components/Button.tsx → src/components/Button.test.tsx
      vendor:
        cursor:
          ai_hint: "Suggest test file path and basic test structure using Vitest"
          quick_fix: true
          priority: high
        claude:
          mode: "reviewer"
          context: "Emphasize test coverage and edge cases"
        copilot:
          suggestions: "detailed"
          examples: true

    - id: no-console-log
      summary: No console.log in production code
      severity: warn
      applies_to:
        patterns: ["**/*.ts", "**/*.js"]
      guidance: |
        Use proper logging library instead of console.log.
        Console statements can leak sensitive information.

        Good: logger.info("User logged in")
        Bad: console.log("User logged in")
      vendor:
        cursor:
          ai_hint: "Suggest logger.info() or logger.error() replacement"
          quick_fix: true
          priority: medium
        claude:
          mode: "assistant"
          context: "Focus on security implications"
        copilot:
          suggestions: "conservative"
          show_examples: true

    - id: typescript-strict
      summary: Use TypeScript strict mode
      severity: error
      applies_to:
        patterns: ["**/*.ts", "**/*.tsx"]
      guidance: |
        Enable strict mode in tsconfig.json for better type safety.

        Required settings:
        - strict: true
        - noImplicitAny: true
        - strictNullChecks: true
      vendor:
        cursor:
          ai_hint: "Check tsconfig.json and suggest specific strict options"
          priority: high
        claude:
          mode: "pair"
          context: "Explain type safety benefits"
        copilot:
          suggestions: "balanced"

    - id: async-error-handling
      summary: Always handle errors in async functions
      severity: error
      applies_to:
        patterns: ["**/*.ts", "**/*.js"]
      guidance: |
        Wrap async operations in try/catch or use .catch().
        Unhandled promise rejections can crash the application.

        Good:
        ```typescript
        try {
          const data = await fetchData();
        } catch (error) {
          logger.error("Failed to fetch", error);
        }
        ```

        Bad:
        ```typescript
        const data = await fetchData(); // No error handling
        ```
      vendor:
        cursor:
          ai_hint: "Suggest try/catch wrapper around async calls"
          quick_fix: true
          priority: high
        claude:
          mode: "reviewer"
          context: "Emphasize error recovery strategies"
        copilot:
          suggestions: "detailed"
          examples: true

    - id: component-documentation
      summary: Document public components with JSDoc
      severity: info
      applies_to:
        patterns: ["src/components/**/*.tsx", "src/components/**/*.ts"]
      guidance: |
        Add JSDoc comments to public components explaining:
        - Purpose and usage
        - Props and their types
        - Return value
        - Examples

        Good:
        ```typescript
        /**
         * Button component with loading state
         * @param label - Button text
         * @param onClick - Click handler
         * @param loading - Show loading spinner
         */
        export function Button({ label, onClick, loading }: ButtonProps) {
          // ...
        }
        ```
      vendor:
        cursor:
          ai_hint: "Generate JSDoc template based on component props"
          quick_fix: true
          priority: low
        claude:
          mode: "assistant"
          context: "Focus on clear, concise documentation"
        copilot:
          suggestions: "detailed"
          show_template: true
  ````

  level: 2
  fingerprint: rules
  source_file: .aligntrue/rules.md
  vendor:
  aligntrue:
  frontmatter:
  title: Rules
