/**
 * AGENTS.md starter template (Natural Markdown)
 * Clean, user-friendly format without explicit rule structure
 */

export function generateAgentsMdStarter(_projectId?: string): string {
  return `# Project Rules

This file contains guidance for AI coding assistants working on this project.

## TypeScript Strict Mode

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

**💡 Tip:** Edit these sections to match your project's needs, then run \`aligntrue sync\` to update other agents.
`;
}

/**
 * Get the default path for AGENTS.md starter template
 */
export function getAgentsMdStarterPath(): string {
  return "AGENTS.md";
}
