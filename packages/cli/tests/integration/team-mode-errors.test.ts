/**
 * Team mode error handling tests
 * Tests error messages and validation for team mode commands
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sync } from "../../src/commands/sync/index.js";
import { team } from "../../src/commands/team.js";
import * as clack from "@clack/prompts";

vi.mock("@clack/prompts");

describe("Team Mode Error Handling", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    vi.clearAllMocks();
    originalCwd = process.cwd();

    testDir = join(tmpdir(), `team-errors-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
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

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("--accept-agent flag validation", () => {
    it("throws clear error when --accept-agent is missing value", async () => {
      // Create minimal AlignTrue setup
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(
        ".aligntrue/config.yaml",
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        ".aligntrue/.rules.yaml",
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
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(
        ".aligntrue/config.yaml",
        `
exporters:
  - cursor
mode: solo
version: "1"
`,
      );
      writeFileSync(
        ".aligntrue/.rules.yaml",
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
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(
        ".aligntrue/config.yaml",
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
        ".aligntrue/.rules.yaml",
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
        ".aligntrue.lock.json",
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
        ".aligntrue/allow.yaml",
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

        // Check error message mentions correct command
        const errorCalls = consoleErrorSpy.mock.calls.flat().join(" ");
        expect(errorCalls).toContain("aligntrue team approve");
        expect(errorCalls).not.toContain("aligntrue lock");
      } finally {
        // Restore mocks
        process.exit = originalExit;
        (process.stdin as any).isTTY = originalStdinIsTTY;
        (process.stdout as any).isTTY = originalStdoutIsTTY;
      }
    });
  });

  describe("Team command validation", () => {
    it("team approve requires source argument", async () => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(
        ".aligntrue/config.yaml",
        `
mode: team
version: "1"
`,
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Try approve without source
      await expect(team(["approve"])).rejects.toThrow();

      const errorCalls = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(errorCalls).toContain("No sources provided");
    });

    it("team approve --current requires lockfile", async () => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(
        ".aligntrue/config.yaml",
        `
mode: team
version: "1"
`,
      );

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Try approve --current without lockfile
      await expect(team(["approve", "--current"])).rejects.toThrow();

      const errorCalls = consoleErrorSpy.mock.calls.flat().join(" ");
      expect(errorCalls).toContain("Lockfile not found");
    });
  });
});
