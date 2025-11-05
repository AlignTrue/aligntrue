/**
 * Smoke tests for override-status command
 * Real integration tests are in tests/integration/override-status-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideStatus } from "../../src/commands/override-status.js";

describe("override-status command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
    }) as never;

    await overrideStatus(["--help"]);

    process.exit = originalExit;
    expect(exitCalled).toBe(true);
  });

  it("requires config file", async () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    const originalCwd = process.cwd();
    try {
      process.chdir("/tmp");
      await overrideStatus([]);
    } catch {
      // Expected
    } finally {
      process.chdir(originalCwd);
      process.exit = originalExit;
    }

    expect(exitCode).toBeGreaterThan(0);
  });
});
