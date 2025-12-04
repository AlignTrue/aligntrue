id: local-rules
version: 1.0.0
spec_version: "1"
sections:

- heading: Rules
  content: >

  # Monorepo scopes rules

  This file demonstrates path-based rule application for monorepos with
  different tech stacks.

  ```aligntrue

  id: monorepo-scopes

  version: "1.0.0"

  spec_version: "1"


  profile:
    id: example/monorepo-scopes
    version: "1.0.0"

  # Base rules (apply to all scopes)

  rules:
    - id: base.no-secrets
      summary: Never commit secrets to version control
      severity: error
      applies_to:
        patterns: ["**/*"]
      guidance: |
        Never commit API keys, passwords, or tokens to version control.
        Use environment variables or secure secret management.

    - id: base.require-tests
      summary: All features must have tests
      severity: error
      applies_to:
        patterns: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.py"]
      guidance: |
        Write unit tests for all new features.
        Test files should be co-located with source files.

    - id: base.no-todos
      summary: Convert TODOs to issues before merging
      severity: warn
      applies_to:
        patterns: ["**/*"]
      guidance: |
        TODO comments should be converted to GitHub issues.
        Instead of: // TODO: refactor this
        Do: Create issue, then // Issue #123: refactor this

  # Next.js specific rules (apps/web)
    - id: nextjs.server-client-boundary
      summary: Respect Next.js server/client boundaries
      severity: error
      applies_to:
        patterns: ["apps/web/**/*.tsx", "apps/web/**/*.ts"]
      guidance: |
        Use 'use client' directive for client components.
        Use 'use server' for server actions.
        Don't mix server and client code without proper boundaries.

    - id: nextjs.image-optimization
      summary: Use Next.js Image component for images
      severity: warn
      applies_to:
        patterns: ["apps/web/**/*.tsx"]
      guidance: |
        Use next/image instead of <img> for automatic optimization.
        Good: <Image src="/photo.jpg" width={500} height={300} />
        Bad: <img src="/photo.jpg" />

  # Node.js specific rules (packages/api)
    - id: node.async-await
      summary: Use async/await instead of callbacks
      severity: warn
      applies_to:
        patterns: ["packages/api/**/*.ts"]
      guidance: |
        Prefer async/await over callbacks for better readability.
        Good: const data = await fetchData();
        Bad: fetchData((err, data) => { ... });

    - id: node.error-handling
      summary: Always handle errors in async functions
      severity: error
      applies_to:
        patterns: ["packages/api/**/*.ts"]
      guidance: |
        Wrap async operations in try/catch or use .catch().
        Unhandled promise rejections can crash the server.

  # Python specific rules (services/worker)
    - id: python.type-hints
      summary: Use type hints for function parameters and returns
      severity: warn
      applies_to:
        patterns: ["services/worker/**/*.py"]
      guidance: |
        Add type hints to improve code clarity and catch errors.
        Good: def process(data: dict) -> bool:
        Bad: def process(data):

    - id: python.docstrings
      summary: Add docstrings to public functions
      severity: info
      applies_to:
        patterns: ["services/worker/**/*.py"]
      guidance: |
        Document public functions with docstrings.
        Use Google or NumPy style for consistency.

  # Scopes: Path-based rule application

  scopes:
    # Frontend: Next.js app
    - path: "apps/web"
      include: ["**/*.ts", "**/*.tsx"]
      exclude: ["**/*.test.ts", "**/*.test.tsx"]
      rulesets: ["base-rules", "nextjs-rules"]

    # Backend: Node.js API
    - path: "packages/api"
      include: ["**/*.ts"]
      exclude: ["**/*.test.ts"]
      rulesets: ["base-rules", "node-rules"]

    # Worker: Python service
    - path: "services/worker"
      include: ["**/*.py"]
      exclude: ["**/*_test.py", "**/tests/**"]
      rulesets: ["base-rules", "python-rules"]

  # Merge configuration

  merge:
    strategy: "deep"
    order: ["root", "path", "local"]
  ```

  level: 2
  fingerprint: rules
  source_file: .aligntrue/rules.md
  vendor:
  aligntrue:
  frontmatter:
  title: Rules
