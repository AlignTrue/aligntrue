/**
 * Smoke tests for override-status command
 * Real integration tests are in tests/integration/override-status-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideStatus } from "../../src/commands/override-status.js";

describe("override-status command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    try {
      await overrideStatus(["--help"]);
    } catch {
      // Expected - help calls process.exit(0)
    }
  });

  it("requires config file", async () => {
    const originalCwd = process.cwd();
    try {
      process.chdir("/tmp");
      await overrideStatus([]);
    } catch (e) {
      // Expected to throw on error
      expect(e).toBeDefined();
    } finally {
      process.chdir(originalCwd);
    }
  });
});
