/**
 * Test project setup utilities
 * Provides standardized test project initialization and cleanup
 */

import { mkdirSync, writeFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { cleanupDir } from "./fs-cleanup.js";
import { tmpdir } from "os";

/**
 * Test project context with cleanup
 */
export interface TestProjectContext {
  /** Root project directory */
  projectDir: string;
  /** .aligntrue directory path */
  aligntrueDir: string;
  /** .aligntrue/rules directory path */
  rulesDir: string;
  /** Cleanup function to remove test directory */
  cleanup: () => Promise<void>;
}

/**
 * Rule file for the new rules directory format
 */
export interface RuleFileSpec {
  /** Filename (e.g., "testing.md") */
  filename: string;
  /** Title for frontmatter */
  title: string;
  /** Content (markdown body) */
  content: string;
  /** Optional scope */
  scope?: string;
  /** Optional description */
  description?: string;
}

/**
 * Setup options for test project
 */
export interface SetupOptions {
  /** Skip creating default config and rules files */
  skipFiles?: boolean;
  /** Custom config.yaml content */
  customConfig?: string;
  /** Custom rule files to create (new format) */
  rules?: RuleFileSpec[];
  /** @deprecated Use rules instead - Custom .rules.yaml content (legacy format) */
  customRules?: string;
  /** Use legacy .rules.yaml format instead of rules directory */
  useLegacyFormat?: boolean;
}

/**
 * Default minimal config.yaml for tests (new format)
 */
const DEFAULT_CONFIG = `mode: solo
profile:
  id: test-user
sources:
  - type: local
    path: .aligntrue/rules
exporters:
  - cursor
  - agents
`;

/**
 * Default minimal .rules.yaml for tests (legacy format)
 */
const DEFAULT_RULES_YAML = `spec_version: "1"
sections: []
`;

/**
 * Default rule files for tests (new format)
 */
const DEFAULT_RULES: RuleFileSpec[] = [
  {
    filename: "global.md",
    title: "Global Guidelines",
    content: `# Global Guidelines

## Code Style
- Keep functions small and focused
- Use descriptive variable names
`,
  },
];

/**
 * Create a rule file in the new markdown format
 */
function createRuleFile(rulesDir: string, rule: RuleFileSpec): void {
  const frontmatter = [
    "---",
    `title: "${rule.title}"`,
    rule.description ? `description: "${rule.description}"` : null,
    rule.scope ? `scope: "${rule.scope}"` : null,
    "original_source: test-template",
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const content = `${frontmatter}\n\n${rule.content}`;
  writeFileSync(join(rulesDir, rule.filename), content);
}

/**
 * Setup a test AlignTrue project with standard directory structure
 *
 * Creates project directory, .aligntrue subdirectory, and optionally
 * standard config and rules files. Returns context with cleanup function.
 *
 * @param options - Setup options
 * @returns Test project context with cleanup
 *
 * @example
 * ```typescript
 * const ctx = setupTestProject();
 * // Use ctx.projectDir, ctx.aligntrueDir, ctx.rulesDir
 * await ctx.cleanup(); // Clean up when done
 * ```
 *
 * @example
 * ```typescript
 * // With custom rules
 * const ctx = setupTestProject({
 *   rules: [{ filename: "testing.md", title: "Testing", content: "# Testing\n..." }]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Skip file creation for edge case tests
 * const ctx = setupTestProject({ skipFiles: true });
 * ```
 */
export function setupTestProject(
  options: SetupOptions = {},
): TestProjectContext {
  const {
    skipFiles = false,
    customConfig,
    rules,
    customRules,
    useLegacyFormat = false,
  } = options;

  // Create directory structure
  const projectDir = mkdtempSync(join(tmpdir(), "aligntrue-test-project-"));
  const aligntrueDir = join(projectDir, ".aligntrue");
  mkdirSync(aligntrueDir, { recursive: true });

  const rulesDir = join(aligntrueDir, "rules");
  if (!useLegacyFormat) {
    mkdirSync(rulesDir, { recursive: true });
  }

  // Create standard files unless skipped
  if (!skipFiles) {
    const configContent = customConfig ?? DEFAULT_CONFIG;
    writeFileSync(join(aligntrueDir, "config.yaml"), configContent);

    if (useLegacyFormat) {
      // Legacy format: single .rules.yaml file
      const rulesContent = customRules ?? DEFAULT_RULES_YAML;
      writeFileSync(join(aligntrueDir, ".rules.yaml"), rulesContent);
    } else {
      // New format: individual .md files in rules directory
      const ruleFiles = rules ?? DEFAULT_RULES;
      for (const rule of ruleFiles) {
        createRuleFile(rulesDir, rule);
      }
    }
  }

  return {
    projectDir,
    aligntrueDir,
    rulesDir,
    cleanup: () => cleanupDir(projectDir),
  };
}
