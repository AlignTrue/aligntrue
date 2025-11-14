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
  /** Cleanup function to remove test directory */
  cleanup: () => Promise<void>;
}

/**
 * Setup options for test project
 */
export interface SetupOptions {
  /** Skip creating default config and rules files */
  skipFiles?: boolean;
  /** Custom config.yaml content */
  customConfig?: string;
  /** Custom .rules.yaml content */
  customRules?: string;
}

/**
 * Default minimal config.yaml for tests
 */
const DEFAULT_CONFIG = `mode: solo
profile:
  id: test-user
spec_version: "1"
`;

/**
 * Default minimal .rules.yaml for tests
 */
const DEFAULT_RULES = `spec_version: "1"
sections: []
`;

/**
 * Setup a test AlignTrue project with standard directory structure
 *
 * Creates project directory, .aligntrue subdirectory, and optionally
 * standard config and rules files. Returns context with cleanup function.
 *
 * @param baseDir - Base directory for test project
 * @param options - Setup options
 * @returns Test project context with cleanup
 *
 * @example
 * ```typescript
 * const ctx = setupTestProject("/tmp/test-123");
 * // Use ctx.projectDir, ctx.aligntrueDir
 * await ctx.cleanup(); // Clean up when done
 * ```
 *
 * @example
 * ```typescript
 * // With custom config
 * const ctx = setupTestProject("/tmp/test-123", {
 *   customConfig: "mode: team\n..."
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Skip file creation for edge case tests
 * const ctx = setupTestProject("/tmp/test-123", {
 *   skipFiles: true
 * });
 * ```
 */
export function setupTestProject(
  options: SetupOptions = {},
): TestProjectContext {
  const { skipFiles = false, customConfig, customRules } = options;

  // Create directory structure
  const projectDir = mkdtempSync(join(tmpdir(), "aligntrue-test-project-"));
  // mkdirSync(projectDir, { recursive: true }); // mkdtempSync already creates it
  const aligntrueDir = join(projectDir, ".aligntrue");
  mkdirSync(aligntrueDir, { recursive: true });

  // Create standard files unless skipped
  if (!skipFiles) {
    const configContent = customConfig ?? DEFAULT_CONFIG;
    const rulesContent = customRules ?? DEFAULT_RULES;

    writeFileSync(join(aligntrueDir, "config.yaml"), configContent);
    writeFileSync(join(aligntrueDir, ".rules.yaml"), rulesContent);
  }

  return {
    projectDir,
    aligntrueDir,
    cleanup: () => cleanupDir(projectDir),
  };
}
