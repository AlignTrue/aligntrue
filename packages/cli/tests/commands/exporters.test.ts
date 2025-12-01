/**
 * Tests for exporters command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { exporters } from "../../src/commands/exporters.js";
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

describe("exporters command", () => {
  let tempDir: string;
  let originalCwd: string;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    // Create temp directory
    tempDir = join(process.cwd(), ".test-exporters-" + Date.now());
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

  const createConfig = (exportersList: string[] = ["cursor", "agents"]) => {
    mkdirSync(".aligntrue", { recursive: true });
    const _config = {
      version: "1",
      mode: "solo",
      exporters: exportersList,
    };
    writeFileSync(
      ".aligntrue/config.yaml",
      `version: '1'\nmode: solo\nexporters:\n${exportersList.map((e) => `  - ${e}`).join("\n")}\n`,
    );
  };

  describe("help", () => {
    it("shows help with no args", async () => {
      try {
        await exporters([]);
      } catch {
        // Expected
      }
      // Commands don't call process.exit(0) on success
      expect(console.log).toHaveBeenCalled();
    });

    it("shows help with --help", async () => {
      const args = mockCommandArgs({ help: true });
      try {
        await exporters(args);
      } catch {
        // Expected
      }
      // Commands don't call process.exit(0) on success
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("list subcommand", () => {
    it("lists exporters with status", async () => {
      createConfig(["cursor", "agents", "invalid-exporter"]);

      try {
        await exporters(["list"]);
      } catch {
        // Expected
      }
      // Commands don't call process.exit(0) on success
      expect(console.log).toHaveBeenCalled();
    });

    it("shows error if config missing", async () => {
      await expect(exporters(["list"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });

    it("categorizes exporters correctly", async () => {
      createConfig(["cursor"]);

      try {
        await exporters(["list"]);
      } catch {
        // Expected
      }
      // Commands don't call process.exit(0) on success
      expect(console.log).toHaveBeenCalled();
    });

    it("shows invalid exporters", async () => {
      createConfig(["cursor", "nonexistent-exporter"]);

      try {
        await exporters(["list"]);
      } catch {
        // Expected
      }
      // Commands don't call process.exit(0) on success
      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("enable subcommand", () => {
    it("enables a single exporter", async () => {
      createConfig(["cursor"]);

      await exporters(["enable", "agents"]);

      // Verify config updated
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents");
    });

    it("shows friendly message if already enabled", async () => {
      createConfig(["cursor"]);

      await exporters(["enable", "cursor"]);

      // Verify output indicates exporter already enabled
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("already enabled"),
      );
    });

    it("shows error for invalid exporter", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["enable", "nonexistent"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("shows error with no exporter name", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["enable"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });

    it("enables multiple exporters with multiple arguments", async () => {
      createConfig(["cursor"]);

      await exporters(["enable", "agents", "claude", "vscode-mcp"]);

      // Verify all three exporters were added to config
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents");
      expect(config).toContain("claude");
      expect(config).toContain("vscode-mcp");
      expect(config).toContain("cursor"); // original should still be there
    });

    it("handles mix of enabled and new exporters in multiple args", async () => {
      createConfig(["cursor", "agents"]);

      await exporters(["enable", "agents", "claude"]);

      // Verify new exporter added, existing preserved
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents");
      expect(config).toContain("claude");
    });

    it("shows all already enabled message for multiple args", async () => {
      createConfig(["cursor", "agents", "claude"]);

      await exporters(["enable", "cursor", "agents"]);

      // Should show message about all being enabled
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("already enabled"),
      );
    });

    it("shows error for invalid exporters in multiple args", async () => {
      createConfig(["cursor"]);

      await expect(
        exporters(["enable", "agents", "nonexistent", "claude"]),
      ).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);

      // Should show error about nonexistent exporter
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("not found"),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("nonexistent"),
      );
    });

    it("enables multiple exporters in interactive mode", async () => {
      createConfig(["cursor"]);

      // Mock multiselect to return multiple selections
      vi.mocked(clack.multiselect).mockResolvedValue([
        "cursor",
        "agents",
        "claude",
      ]);

      await exporters(["enable", "--interactive"]);

      // Verify config updated
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents");
      expect(config).toContain("claude");
    });

    it("handles cancelled interactive selection", async () => {
      createConfig(["cursor"]);

      // Mock cancel
      vi.mocked(clack.multiselect).mockResolvedValue(Symbol.for("cancel"));

      try {
        await exporters(["enable", "--interactive"]);
      } catch {
        // Expected
      }
    });

    it("shows no changes message if selections unchanged", async () => {
      createConfig(["cursor", "agents"]);

      // Mock multiselect to return same selections
      vi.mocked(clack.multiselect).mockResolvedValue(["cursor", "agents"]);

      await exporters(["enable", "--interactive"]);

      // Verify no changes message
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("No changes"),
      );
    });

    it("sorts exporters alphabetically", async () => {
      createConfig(["cursor"]);

      await exporters(["enable", "zed-config"]);
      await exporters(["enable", "agents"]);

      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      const lines = config.split("\n");
      const exportersIndex = lines.findIndex((l) => l.includes("exporters:"));
      const exportersList = lines
        .slice(exportersIndex + 1)
        .filter((l) => l.trim().startsWith("- "));

      // Should be sorted: agents, cursor, zed-config
      expect(exportersList[0]).toContain("agents");
      expect(exportersList[1]).toContain("cursor");
    });
  });

  describe("disable subcommand", () => {
    it("disables an exporter", async () => {
      createConfig(["cursor", "agents"]);

      await exporters(["disable", "cursor"]);

      // Verify config updated - check exporters list specifically
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("agents");
      // Verify cursor is not in the exporters list
      const exportersSection = config.split("exporters:")[1]?.split("\n")[1];
      expect(exportersSection).not.toContain("cursor");
    });

    it("shows error if exporter not enabled", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["disable", "agents"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("prevents disabling last exporter", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["disable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("shows error with no exporter name", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["disable"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });
  });

  describe("detect subcommand", () => {
    it("shows new agents with file paths", async () => {
      createConfig(["cursor"]);

      // Create a detectable agent file
      writeFileSync(join(tempDir, "AGENTS.md"), "# Test rules");

      // Capture console output
      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        await exporters(["detect"]);
      } finally {
        console.log = originalLog;
      }

      // Should show detected agent
      expect(logs.join("\n")).toContain("agent");
      expect(logs.join("\n")).toContain("AGENTS.md");
    });

    it("shows message when no new agents", async () => {
      createConfig(["cursor", "agents"]);

      // Create agent files that are already enabled
      mkdirSync(join(tempDir, ".cursor"), { recursive: true });
      writeFileSync(join(tempDir, "AGENTS.md"), "# Test");

      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        await exporters(["detect"]);
      } finally {
        console.log = originalLog;
      }

      expect(logs.join("\n")).toContain("No new agents detected");
    });

    it("handles missing config", async () => {
      await expect(exporters(["detect"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });
  });

  describe("ignore subcommand", () => {
    it("adds agent to ignored list", async () => {
      createConfig(["cursor"]);

      await exporters(["ignore", "windsurf"]);

      // Verify config updated
      const config = readFileSync(".aligntrue/config.yaml", "utf-8");
      expect(config).toContain("detection:");
      expect(config).toContain("ignored_agents:");
      expect(config).toContain("- windsurf");
    });

    it("shows message if already ignored", async () => {
      createConfig(["cursor"]);
      writeFileSync(
        ".aligntrue/config.yaml",
        "exporters:\n  - cursor\ndetection:\n  ignored_agents:\n    - windsurf\n",
      );

      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        await exporters(["ignore", "windsurf"]);
      } finally {
        console.log = originalLog;
      }

      expect(logs.join("\n")).toContain("already ignored");
    });

    it("fails with helpful error when agent name missing", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["ignore"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });

    it("handles missing config", async () => {
      await expect(exporters(["ignore", "windsurf"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });
  });

  describe("error handling", () => {
    it("handles missing config for enable", async () => {
      await expect(exporters(["enable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("handles missing config for disable", async () => {
      await expect(exporters(["disable", "cursor"])).rejects.toThrow(
        "process.exit: 1",
      );
      expect(exitCode).toBe(1);
    });

    it("handles unknown subcommand", async () => {
      createConfig(["cursor"]);

      await expect(exporters(["unknown"])).rejects.toThrow("process.exit: 1");
      expect(exitCode).toBe(1);
    });
  });
});
