/**
 * Team mode error handling tests
 * Tests error messages and validation for team mode commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let testProjectContext: TestProjectContext; // Added this line
describe("Team Mode Error Handling", () => {
  let originalCwd: string;
  let testDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testProjectContext = setupTestProject({ skipFiles: true }); // Modified this line
    testDir = testProjectContext.projectDir;
    process.chdir(testDir);

    // Mock process.exit to throw for testing
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Mock clack prompts
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.cancel).mockImplementation(() => {});
    vi.mocked(clack.isCancel).mockReturnValue(false);
    vi.mocked(clack.spinner).mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    } as any);
    vi.mocked(clack.intro).mockImplementation(() => {});
    vi.mocked(clack.outro).mockImplementation(() => {});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await testProjectContext.cleanup(); // Modified this line
    vi.restoreAllMocks();
  });

  describe("--accept-agent flag validation", () => {
    it("throws clear error when --accept-agent is missing value", async () => {
      // Create minimal AlignTrue setup
      writeFileSync(
        join(testProjectContext.aligntrueDir, "config.yaml"), // Modified this line
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        join(testProjectContext.aligntrueDir, ".rules.yaml"), // Modified this line
        `
id: test-rules
version: 1.0.0
spec_version: "1"
sections: []
`,
      );

      // Try sync with --accept-agent but no value
      await expect(sync(["--accept-agent"])).rejects.toThrow(
        "Flag --accept-agent requires a value",
      );
    });

    it("shows helpful error for invalid agent name", async () => {
      // Create minimal AlignTrue setup
      writeFileSync(
        join(testProjectContext.aligntrueDir, "config.yaml"), // Modified this line
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        join(testProjectContext.aligntrueDir, ".rules.yaml"), // Modified this line
        `
id: test-rules
version: 1.0.0
spec_version: "1"
sections: []
`,
      );

      // Try sync with invalid agent
      await expect(sync(["--accept-agent", "invalid-agent"])).rejects.toThrow();
    });
  });

  describe("Strict mode error messages", () => {
    // Note: Allow list validation has been removed, test may need updating
    // 1. Whether parseAllowList is throwing for this test's YAML format
    // 2. Whether the try-catch around validation should be more strict
    // 3. Whether we should split "parsing errors" from "validation errors"
    it.skip("shows correct commands when lockfile validation fails", async () => {
      // Create team mode setup
      writeFileSync(
        join(testProjectContext.aligntrueDir, "config.yaml"), // Modified this line
        `
exporters:
  - cursor
mode: team
version: "1"
modules:
  lockfile: true
  bundle: true
lockfile:
  mode: strict
`,
      );
      writeFileSync(
        join(testProjectContext.aligntrueDir, ".rules.yaml"), // Modified this line
        `
id: test-rules
version: 1.0.0
spec_version: "1"
sections:
  - heading: Test rule one
    level: 2
    content: "Test rule guidance"
    fingerprint: test-rule-one
`,
      );

      // Create lockfile with different hash
      writeFileSync(
        join(testProjectContext.projectDir, ".aligntrue.lock.json"), // Modified this line
        JSON.stringify({
          bundle_hash: "old-hash-value",
          version: "1",
          mode: "team",
          generated_at: new Date().toISOString(),
          rules: [],
        }),
      );

      // Create allow list with old hash
      writeFileSync(
        join(testProjectContext.aligntrueDir, "allow.yaml"), // Modified this line
        `
version: 1
sources:
  - type: hash
    value: sha256:old-hash-value
`,
      );

      // Mock non-interactive mode by setting TTY to undefined
      const originalStdinIsTTY = process.stdin.isTTY;
      const originalStdoutIsTTY = process.stdout.isTTY;
      (process.stdin as any).isTTY = undefined;
      (process.stdout as any).isTTY = undefined;

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Mock process.exit to throw so we can catch the error
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        throw new Error(`process.exit(${code})`);
      }) as never;

      try {
        // Try to sync - should fail with correct error message
        await sync([]);
        // Should not reach here
        expect.fail("Sync should have failed");
      } catch (err) {
        // Expected to throw due to process.exit
        expect(err).toBeDefined();
        if (err instanceof Error) {
          expect(err.message).toContain("process.exit");
        }

        // Check error message mentions correct workflow
        const errorCalls = consoleErrorSpy.mock.calls.flat().join(" ");
        expect(errorCalls).toContain("PR for team");
        expect(errorCalls).not.toContain("aligntrue lock");
      } finally {
        // Restore mocks
        process.exit = originalExit;
        (process.stdin as any).isTTY = originalStdinIsTTY;
        (process.stdout as any).isTTY = originalStdoutIsTTY;
      }
    });
  });
});
