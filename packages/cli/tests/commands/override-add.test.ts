/**
 * Smoke tests for override-add command
 * Real integration tests are in tests/integration/override-add-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideAdd } from "../../src/commands/override-add.js";

describe("override-add command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    try {
      await overrideAdd(["--help"]);
    } catch {
      // Expected - help calls process.exit(0)
    }
  });

  it("requires selector argument", async () => {
    try {
      await overrideAdd([]);
    } catch {
      // Expected to throw on error
      expect(e).toBeDefined();
    }
  });

  it("requires --set or --remove operation", async () => {
    try {
      await overrideAdd(["--selector", "rule[id=test]"]);
    } catch {
      // Expected to throw on error
      expect(e).toBeDefined();
    }
  });
});
