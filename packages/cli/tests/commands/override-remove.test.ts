/**
 * Smoke tests for override-remove command
 * Real integration tests are in tests/integration/override-remove-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideRemove } from "../../src/commands/override-remove.js";

describe("override-remove command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
    }) as never;

    await overrideRemove(["--help"]);

    process.exit = originalExit;
    expect(exitCalled).toBe(true);
  });

  it("requires index argument", async () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    await overrideRemove([]);

    process.exit = originalExit;
    expect(exitCode).toBeGreaterThan(0);
  });
});
