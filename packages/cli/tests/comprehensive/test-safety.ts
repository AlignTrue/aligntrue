/**
 * Test Safety Guards
 * Ensures tests run in isolated environments and don't interfere with workspace state
 */

export interface TestEnvironment {
  testWorkspace: string;
  cliPath: string;
  logFile: string;
}

/**
 * Validates test environment to prevent workspace corruption
 *
 * Safety checks:
 * 1. Current working directory must be in /tmp/ (isolated test environment)
 * 2. Required environment variables must be set
 * 3. Test workspace must not be in workspace root
 *
 * @throws Error if validation fails
 * @returns TestEnvironment with paths to use for testing
 */
export function validateTestEnvironment(): TestEnvironment {
  const cwd = process.cwd();
  const testWorkspace = process.env.TEST_WORKSPACE;
  const cliPath = process.env.ALIGNTRUE_CLI;
  const logFile = process.env.LOG_FILE;

  // CRITICAL: Prevent testing in workspace root
  const isInWorkspaceRoot =
    cwd.includes("/Sites/aligntrue") &&
    !cwd.includes("/tmp/") &&
    !cwd.includes("/.") &&
    !cwd.includes("/node_modules/");

  if (isInWorkspaceRoot) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION: Tests must run in isolated /tmp/ directories, not workspace root!\n` +
        `\n` +
        `Current directory: ${cwd}\n` +
        `\n` +
        `This prevents accidental corruption of your local AlignTrue configuration and dogfooding setup.\n` +
        `\n` +
        `Run tests from packages/cli with:\n` +
        `  pnpm test:comprehensive  # All layers\n` +
        `  pnpm test:layer 1        # Specific layer\n` +
        `  pnpm test:distribution   # Layer 1 only\n`,
    );
  }

  // Validate environment variables
  if (!testWorkspace) {
    throw new Error(
      `TEST_WORKSPACE environment variable not set.\n` +
        `This should be set by the test runner.`,
    );
  }

  if (!cliPath) {
    throw new Error(
      `ALIGNTRUE_CLI environment variable not set.\n` +
        `Should point to: packages/cli/dist/index.js`,
    );
  }

  if (!logFile) {
    throw new Error(
      `LOG_FILE environment variable not set.\n` +
        `This should be set by the test runner.`,
    );
  }

  // Verify test workspace is in /tmp/
  if (!testWorkspace.includes("/tmp/")) {
    throw new Error(
      `CRITICAL: Test workspace must be in /tmp/, got: ${testWorkspace}`,
    );
  }

  return {
    testWorkspace,
    cliPath,
    logFile,
  };
}

/**
 * Verifies test environment is safe before running tests
 * Use this at the start of each layer test
 */
export function assertTestSafety(): void {
  validateTestEnvironment();
}
