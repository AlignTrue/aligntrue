/**
 * Starter template for AlignTrue rules
 * Comprehensive example with 5 rules demonstrating key features
 */

/**
 * Get the comprehensive starter template
 * Shows all major features: basic rules, severity levels, checks, vendor metadata
 */
export function getStarterTemplate(projectId: string = "my-project"): string {
  return `# AlignTrue Rules

Welcome! This file contains rules for your AI coding assistants.

AlignTrue syncs these rules to all your agents (Cursor, VS Code, Copilot, etc.) 
so they work consistently across your project.

## How it works

1. Edit the rules below to match your project needs
2. Run \`aligntrue sync\` to update your agent configs
3. Your AI assistants will follow these rules automatically

---

\`\`\`aligntrue
id: ${projectId}-rules
version: 1.0.0
spec_version: "1"
rules:
  - id: testing.require-tests
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
      - "**/*.js"
      - "**/*.jsx"
    guidance: |
      All features must have tests to ensure reliability.
      Write tests alongside your code, not as an afterthought.
      
      Use descriptive test names that explain what you're testing.
      Aim for >80% coverage on new code.
    tags:
      - testing
      - quality
    vendor:
      cursor:
        ai_hint: "Suggest test scaffolding with vitest or jest"

  - id: docs.update-readme
    severity: info
    applies_to:
      - "README.md"
      - "docs/**/*.md"
    guidance: |
      Keep documentation up to date with any significant changes.
      
      A good README helps onboarding and reduces support burden.
      Update examples when APIs change.
    tags:
      - documentation

  - id: security.no-secrets
    severity: error
    applies_to:
      - "**/*"
    guidance: |
      Never commit API keys, tokens, passwords, or other secrets.
      
      Use environment variables or a secrets manager instead.
      If a secret is committed, rotate it immediately.
    tags:
      - security
    check:
      type: regex
      pattern: "(api[_-]?key|secret|token|password)\\\\s*=\\\\s*['\\\"][^'\\\"]{8,}['\\\"]"
      message: "Possible hardcoded secret detected"

  - id: style.consistent-naming
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
    guidance: |
      Use consistent naming conventions:
      - camelCase for variables and functions
      - PascalCase for types, interfaces, and classes
      - UPPER_SNAKE_CASE for constants
      
      Consistent naming makes code easier to read and maintain.
    tags:
      - style
      - readability
    vendor:
      cursor:
        ai_hint: "Suggest rename if inconsistent with project conventions"

  - id: performance.avoid-n-plus-one
    severity: warn
    applies_to:
      - "**/*.ts"
      - "**/*.tsx"
    guidance: |
      Watch out for N+1 query problems in loops.
      
      Instead of fetching data inside a loop, fetch all needed data upfront
      or use batch operations.
      
      Example: Use Promise.all() for parallel async operations.
    tags:
      - performance
      - database
\`\`\`

---

## Next steps

1. **Customize these rules** - Edit the rules above to match your project
2. **Add more rules** - Copy a rule block and modify it
3. **Run sync** - \`aligntrue sync\` to update your agent configs
4. **Learn more** - https://aligntrue.dev/docs

## Rule format reference

Each rule has:
- **id**: Unique identifier (e.g., \`testing.require-tests\`)
- **severity**: \`error\` | \`warn\` | \`info\`
- **applies_to**: File patterns (glob syntax)
- **guidance**: Instructions for AI assistants
- **tags**: Optional categorization
- **check**: Optional machine-checkable validation
- **vendor**: Optional agent-specific metadata

Enjoy coding with aligned AI assistants!
`;
}
