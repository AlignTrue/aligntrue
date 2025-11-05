/**
 * Smoke tests for override-add command
 * Real integration tests are in tests/integration/override-add-command.test.ts
 */

import { describe, it, expect } from "vitest";
import { overrideAdd } from "../../src/commands/override-add.js";

describe("override-add command - smoke tests", () => {
  it("shows help with --help flag", async () => {
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
    }) as never;

    await overrideAdd(["--help"]);

    process.exit = originalExit;
    expect(exitCalled).toBe(true);
  });

  it("requires selector argument", async () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    await overrideAdd([]);

    process.exit = originalExit;
    expect(exitCode).toBeGreaterThan(0);
  });

  it("requires --set or --remove operation", async () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    await overrideAdd(["--selector", "rule[id=test]"]);

    process.exit = originalExit;
    expect(exitCode).toBe(1);
  });
});
