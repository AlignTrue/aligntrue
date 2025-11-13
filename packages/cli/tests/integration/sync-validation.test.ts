/**
 * Integration tests for strict IR validation during sync
 *
 * Note: Full sync validation tests require complex setup with proper agent files.
 * For now, we just test that the --force-invalid-ir flag exists and is documented.
 * More comprehensive validation tests should be added once the sync flow is stable.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(process.cwd(), "tests", "tmp", "sync-validation-test");
const CLI_PATH = join(process.cwd(), "dist", "index.js");

/**
 * Helper to safely run CLI commands with proper path handling
 */
function runCli(args: string[], options: { encoding?: string } = {}): string {
  const cmd = [process.execPath, CLI_PATH, ...args].join(" ");
  return execSync(cmd, {
    cwd: TEST_DIR,
    encoding: options.encoding || "utf-8",
  });
}

describe("Sync Validation", () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("--force-invalid-ir flag", () => {
    it("should be documented in help text", () => {
      const result = runCli(["sync", "--help"]);
      expect(result).toContain("--force-invalid-ir");
      expect(result).toContain("Allow sync even with IR validation errors");
    });
  });

  // TODO: Add full integration tests for IR validation
  // These require proper setup with agent files, sources, and two-way sync
  // For now, the validation logic is tested via unit tests and manual testing
});
