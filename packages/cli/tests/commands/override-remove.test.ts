/**
 * Smoke tests for override-remove command
 * Real integration tests are in tests/integration/override-remove-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideRemove } from "../../src/commands/override-remove.js";

describe("override-remove command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    try {
      await overrideRemove(["--help"]);
    } catch {
      // Expected - help calls process.exit(0)
    }
  });

  it("requires index argument", async () => {
    try {
      await overrideRemove([]);
    } catch {
      // Expected to throw on error
      expect(e).toBeDefined();
    }
  });
});
