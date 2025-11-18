/**
 * Canonical source of truth for starter rules
 *
 * All template formats (IR, Cursor, AGENTS.md) are generated from this source.
 * This ensures template consistency and prevents divergence between formats.
 *
 * CRITICAL: When updating starter rules:
 * 1. Modify ONLY this file
 * 2. All other templates auto-generate from this source
 * 3. Rule IDs MUST follow schema pattern: ^[a-z0-9]+(\.[a-z0-9-]+){2,}$
 *    (minimum 3 segments, e.g., quality.typescript.strict)
 * 4. Run tests to validate: pnpm test packages/cli/tests/templates
 *
 * Template generation:
 * - IR format: packages/cli/src/templates/starter-rules.ts (markdown)
 * - Cursor format: packages/cli/src/templates/cursor-starter.ts (.mdc)
 * - AGENTS.md format: packages/cli/src/templates/agents-starter.ts
 *
 * Validation:
 * - Build-time: packages/cli/tests/templates/validation.test.ts
 * - Integration: packages/cli/tests/integration/fresh-init.test.ts
 */

export interface CanonicalRule {
  id: string; // Must match schema pattern (validated at build time)
  severity: "error" | "warn" | "info";
  applies_to: string[];
  guidance: string;
  tags: string[];
  vendor?: {
    cursor?: {
      ai_hint?: string;
    };
  };
}

/**
 * Canonical starter rules
 * These rules are used to generate all template formats
 */
export const STARTER_RULES_CANONICAL: CanonicalRule[] = [
  {
    id: "quality.typescript.strict",
    severity: "error",
    applies_to: ["tsconfig.json"],
    guidance: `Enable strict mode in tsconfig.json.
This enforces noImplicitAny, strictNullChecks, and strictFunctionTypes.
Fix all TypeScript errors before committing.`,
    tags: ["typescript", "quality"],
    vendor: {
      cursor: {
        ai_hint:
          "Check for noImplicitAny and strictNullChecks in tsconfig.json",
      },
    },
  },
  {
    id: "style.naming.conventions",
    severity: "error",
    applies_to: ["**/*.ts", "**/*.tsx"],
    guidance: `Follow these naming conventions:
- Classes: PascalCase (e.g., \`UserRepository\`)
- Functions/variables: camelCase (e.g., \`fetchUserData\`)
- Constants: UPPER_SNAKE_CASE (e.g., \`MAX_RETRIES\`)
- Private properties: prefix with underscore (e.g., \`_cache\`)`,
    tags: ["style", "readability"],
  },
  {
    id: "quality.testing.required",
    severity: "warn",
    applies_to: ["src/**/*.ts", "src/**/*.tsx"],
    guidance: `Write unit tests for all new functions.
Test file naming: \`*.test.ts\` or \`*.spec.ts\`
Aim for >80% code coverage.

Examples:
- src/utils/parser.ts → src/utils/parser.test.ts
- src/components/Button.tsx → src/components/Button.test.tsx`,
    tags: ["testing", "quality"],
    vendor: {
      cursor: {
        ai_hint: "Suggest test scaffolding with vitest or jest",
      },
    },
  },
  {
    id: "style.imports.organized",
    severity: "info",
    applies_to: ["**/*.ts", "**/*.tsx"],
    guidance: `Sort imports alphabetically.
Group imports: node modules first, then local modules.
Remove unused imports before committing.

Example:
\`\`\`typescript
// Node modules
import { readFile } from 'fs/promises'
import { join } from 'path'

// Local modules
import { parseConfig } from './config'
import { logger } from './logger'
\`\`\``,
    tags: ["style", "readability"],
  },
  {
    id: "quality.no.console-log",
    severity: "warn",
    applies_to: ["src/**/*.ts", "src/**/*.tsx"],
    guidance: `Don't use \`console.log()\` in production code.
Use a proper logging library instead.

For debugging during development, use:
- \`console.debug()\` for verbose logs
- \`console.info()\` for informational messages
- \`console.warn()\` for warnings
- \`console.error()\` for errors`,
    tags: ["quality", "logging"],
  },
];
