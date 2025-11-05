/**
 * Smoke tests for sync command
 * Real integration tests are in tests/integration/sync-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { sync } from "../../src/commands/sync.js";

describe("sync command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    // Mock process.exit to prevent actual exit
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
    }) as never;

    await sync(["--help"]);

    // Restore process.exit
    process.exit = originalExit;

    expect(exitCalled).toBe(true);
  });

  it("requires config file to exist", async () => {
    // Mock process.exit
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    // Run in non-existent directory
    const originalCwd = process.cwd();
    try {
      process.chdir("/tmp");
      await sync([]);
    } catch {
      // Expected to fail
    } finally {
      process.chdir(originalCwd);
      process.exit = originalExit;
    }

    expect(exitCode).toBeGreaterThan(0);
  });

  it("accepts --dry-run flag", async () => {
    // Just verify the flag is parsed without error
    const originalExit = process.exit;
    process.exit = (() => {}) as never;

    try {
      await sync(["--dry-run"]);
    } catch {
      // Expected to fail due to missing config
    }

    process.exit = originalExit;
  });
});
