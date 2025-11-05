/**
 * Tests for adapters command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { adapters } from "../../src/commands/adapters.js";
import { mockCommandArgs } from "../utils/command-test-helpers.js";
import * as clack from "@clack/prompts";

// Mock clack prompts
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn((value) => value === Symbol.for("cancel")),
  multiselect: vi.fn(),
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock telemetry
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));

describe("adapters command", () => {
  let tempDir: string;
  let originalCwd: string;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    // Create temp directory
    tempDir = join(process.cwd(), ".test-adapters-" + Date.now());
    mkdirSync(tempDir, { recursive: true });

    // Save original cwd
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Mock process.exit
    originalExit = process.exit;
    exitCode = undefined;
    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`process.exit: ${code}`);
    }) as unknown;

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore
    process.chdir(originalCwd);
    process.exit = originalExit;

    // Cleanup
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }

    vi.clearAllMocks();
  });

  const createConfig = (exporters: string[] = ["cursor", "agents-md"]) => {
    mkdirSync(".aligntrue", { recursive: true });
    const _config = {
      version: "1",
      mode: "solo",
      exporters,
    };
    writeFileSync(
      ".aligntrue/config.yaml",
      `version: '1'\nmode: solo\nexporters:\n${exporters.map((e) => `  - ${e}`).join("\n")}\n`,
    );
  };

  describe("help", () => {
    it("shows help with no args", async () => {
      await expect(adapters([])).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);
    });

    it("shows help with --help", async () => {
      const args = mockCommandArgs({ help: true });
      await expect(adapters(args)).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);
    });
  });

  describe("list subcommand", () => {
    it("lists adapters with status", async () => {
      createConfig(["cursor", "agents-md", "invalid-adapter"]);

      await expect(adapters(["list"])).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);
    });

    it("shows error if config missing", async () => {
      await expect(adapters(["list"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });

    it("categorizes adapters correctly", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["list"])).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);
      // Should show cursor as installed, others as available
    });

    it("shows invalid adapters", async () => {
      createConfig(["cursor", "nonexistent-adapter"]);

      await expect(adapters(["list"])).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);
      // Should show nonexistent-adapter as invalid
    });
  });

  describe("enable subcommand", () => {
    it("enables a single adapter", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["enable", "agents-md"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);

      // Verify config updated
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents-md");
    });

    it("shows friendly message if already enabled", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["enable", "cursor"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);
    });

    it("shows error for invalid adapter", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["enable", "nonexistent"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("shows error with no adapter name", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["enable"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });

    it("enables multiple adapters with multiple arguments", async () => {
      createConfig(["cursor"]);

      await expect(
        adapters(["enable", "agents-md", "claude-md", "vscode-mcp"]),
      ).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);

      // Verify all three adapters were added to config
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents-md");
      expect(config).toContain("claude-md");
      expect(config).toContain("vscode-mcp");
      expect(config).toContain("cursor"); // original should still be there
    });

    it("handles mix of enabled and new adapters in multiple args", async () => {
      createConfig(["cursor", "agents-md"]);

      await expect(
        adapters(["enable", "agents-md", "claude-md"]),
      ).rejects.toThrow("process.exit: 0");
      expect(exitCode).toBe(0);

      // Verify new adapter added, existing preserved
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents-md");
      expect(config).toContain("claude-md");
    });

    it("shows all already enabled message for multiple args", async () => {
      createConfig(["cursor", "agents-md", "claude-md"]);

      await expect(adapters(["enable", "cursor", "agents-md"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);

      // Should show message about all being enabled
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("already enabled"),
      );
    });

    it("shows error for invalid adapters in multiple args", async () => {
      createConfig(["cursor"]);

      await expect(
        adapters(["enable", "agents-md", "nonexistent", "claude-md"]),
      ).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);

      // Should show error about nonexistent adapter
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("not found"),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("nonexistent"),
      );
    });

    it("enables multiple adapters in interactive mode", async () => {
      createConfig(["cursor"]);

      // Mock multiselect to return multiple selections
      vi.mocked(clack.multiselect).mockResolvedValue([
        "cursor",
        "agents-md",
        "claude-md",
      ]);

      await expect(adapters(["enable", "--interactive"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);

      // Verify config updated
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents-md");
      expect(config).toContain("claude-md");
    });

    it("handles cancelled interactive selection", async () => {
      createConfig(["cursor"]);

      // Mock cancel
      vi.mocked(clack.multiselect).mockResolvedValue(Symbol.for("cancel"));

      await expect(adapters(["enable", "--interactive"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);
    });

    it("shows no changes message if selections unchanged", async () => {
      createConfig(["cursor", "agents-md"]);

      // Mock multiselect to return same selections
      vi.mocked(clack.multiselect).mockResolvedValue(["cursor", "agents-md"]);

      await expect(adapters(["enable", "--interactive"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);
    });

    it("sorts exporters alphabetically", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["enable", "zed-config"])).rejects.toThrow(
        "process.exit: 0",
      );
      await expect(adapters(["enable", "agents-md"])).rejects.toThrow(
        "process.exit: 0",
      );

      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      const lines = config.split("\n");
      const exportersIndex = lines.findIndex((l) => l.includes("exporters:"));
      const exportersList = lines
        .slice(exportersIndex + 1)
        .filter((l) => l.trim().startsWith("- "));

      // Should be sorted: agents-md, cursor, zed-config
      expect(exportersList[0]).toContain("agents-md");
      expect(exportersList[1]).toContain("cursor");
    });
  });

  describe("disable subcommand", () => {
    it("disables an adapter", async () => {
      createConfig(["cursor", "agents-md"]);

      await expect(adapters(["disable", "cursor"])).rejects.toThrow(
        "process.exit: 0",
      );
      expect(exitCode).toBe(0);

      // Verify config updated - check exporters list specifically
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents-md");
      // Verify cursor is not in the exporters list (may appear in primary_agent)
      const exportersSection = config.split("exporters:")[1]?.split("\n")[1];
      expect(exportersSection).not.toContain("cursor");
    });

    it("shows error if adapter not enabled", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["disable", "agents-md"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("prevents disabling last adapter", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["disable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("shows error with no adapter name", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["disable"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });
  });

  describe("error handling", () => {
    it("handles missing config for enable", async () => {
      await expect(adapters(["enable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("handles missing config for disable", async () => {
      await expect(adapters(["disable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("handles unknown subcommand", async () => {
      createConfig(["cursor"]);

      await expect(adapters(["unknown"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });
  });
});
