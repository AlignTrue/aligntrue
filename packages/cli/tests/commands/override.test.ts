/**
 * Tests for override command (Phase 3.5)
 * Note: Minimal smoke tests for Session 2 checkpoint
 * Full test suite will be added in Session 3 with add/diff commands
 */

import { describe, expect, it, vi } from "vitest";
import { overrideCommand } from "../../src/commands/override.js";

describe("Override Command - Smoke Tests", () => {
  it("shows help when called without arguments", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand([]);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Usage: aln override");
    expect(output).toContain("status");

    consoleSpy.mockRestore();
  });

  it("shows help with --help flag", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await overrideCommand(["--help"]);

    expect(consoleSpy).toHaveBeenCalled();
    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("Usage: aln override");

    consoleSpy.mockRestore();
  });

  it("warns for unimplemented 'add' subcommand", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["add"]);
    } catch (err) {
      // Expected - process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("warns for unimplemented 'diff' subcommand", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await overrideCommand(["diff"]);
    } catch (err) {
      // Expected - process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it("errors on unknown subcommand", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    try {
      await overrideCommand(["unknown"]);
    } catch (err) {
      // Expected - process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(2);
    exitSpy.mockRestore();
  });
});
