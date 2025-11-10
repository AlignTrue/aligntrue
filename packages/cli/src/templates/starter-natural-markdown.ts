/**
 * Natural markdown starter template
 *
 * Generated from canonical rules in starter-rules-canonical.ts
 * This is the default format for new projects (clean, user-friendly)
 */

export function generateStarterNaturalMarkdown(projectId: string): string {
  return `---
id: "${projectId}-rules"
version: "1.0.0"
summary: "Project rules and guidance for AI coding assistants"
tags: ["quality", "style", "testing"]
---

# TypeScript Strict Mode

Enable strict mode in \`tsconfig.json\`.

This enforces \`noImplicitAny\`, \`strictNullChecks\`, and \`strictFunctionTypes\`.

Fix all TypeScript errors before committing.

## Naming Conventions

Follow these naming conventions:

- **Classes:** PascalCase (e.g., \`UserRepository\`)
- **Functions/variables:** camelCase (e.g., \`fetchUserData\`)
- **Constants:** UPPER_SNAKE_CASE (e.g., \`MAX_RETRIES\`)
- **Private properties:** prefix with underscore (e.g., \`_cache\`)

## Testing Required

Write unit tests for all new functions.

**Test file naming:** \`*.test.ts\` or \`*.spec.ts\`

**Aim for >80% code coverage.**

Examples:
- \`src/utils/parser.ts\` → \`src/utils/parser.test.ts\`
- \`src/components/Button.tsx\` → \`src/components/Button.test.tsx\`

## Organize Imports

Sort imports alphabetically. Group imports: node modules first, then local modules.

Remove unused imports before committing.

Example:

\`\`\`typescript
// Node modules
import { readFile } from 'fs/promises'
import { join } from 'path'

// Local modules
import { parseConfig } from './config'
import { logger } from './logger'
\`\`\`

## No Console Logging

Don't use \`console.log()\` in production code. Use a proper logging library instead.

For debugging during development, use:

- \`console.debug()\` for verbose logs
- \`console.info()\` for informational messages
- \`console.warn()\` for warnings
- \`console.error()\` for errors
`;
}

export function getStarterNaturalMarkdownPath(): string {
  return "AGENTS.md";
}
