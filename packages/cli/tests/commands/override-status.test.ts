/**
 * Smoke tests for override-status command
 * Real integration tests are in tests/integration/override-status-command.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideStatus } from "../../src/commands/override-status.js";

describe("override-status command - smoke tests", () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "aligntrue-override-status-smoke-"));
    process.chdir(tempDir);
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("shows help with --help flag", async () => {
    await expect(overrideStatus(["--help"])).resolves.toBeUndefined();
  });

  it("requires config file", async () => {
    await expect(overrideStatus([])).rejects.toBeDefined();
  });
});
