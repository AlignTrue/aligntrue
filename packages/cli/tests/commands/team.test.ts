/**
 * Tests for team command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { team } from "../../src/commands/team.js";
import * as fs from "fs";
import * as clack from "@clack/prompts";

// Mock filesystem
vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(),
  renameSync: vi.fn(),
}));

// Mock telemetry collector
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));

// Mock @aligntrue/core
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
}));

// Mock @aligntrue/core/team/allow.js
vi.mock("@aligntrue/core/team/allow.js", () => ({
  parseAllowList: vi.fn(),
  addSourceToAllowList: vi.fn(),
  removeSourceFromAllowList: vi.fn(),
  writeAllowList: vi.fn(),
}));

// Mock @clack/prompts
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  confirm: vi.fn(),
  cancel: vi.fn(),
  outro: vi.fn(),
  isCancel: vi.fn(),
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  log: {
    info: vi.fn(),
  },
}));

describe("team command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  describe("help", () => {
    it("shows help with --help flag", async () => {
      await expect(team(["--help"])).rejects.toThrow("process.exit(0)");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Usage: aligntrue team"),
      );
    });

    it("shows help with no args", async () => {
      await expect(team([])).rejects.toThrow("process.exit(0)");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Team mode features:"),
      );
    });
  });

  describe("enable", () => {
    it("enables team mode successfully", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false, bundle: false },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await expect(team(["enable"])).rejects.toThrow("process.exit");

      expect(clack.intro).toHaveBeenCalledWith("Team Mode Enable");
      expect(clack.confirm).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(clack.outro).toHaveBeenCalledWith("✓ Team mode enabled");
    });

    it("fails when config not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(team(["enable"])).rejects.toThrow("process.exit(1)");

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Config file not found"),
      );
    });

    it("handles already in team mode", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "team",
        modules: { lockfile: true, bundle: true },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });

      await expect(team(["enable"])).rejects.toThrow("process.exit(0)");

      expect(console.log).toHaveBeenCalledWith("✓ Already in team mode");
    });

    it("cancels when user declines", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false, bundle: false },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await expect(team(["enable"])).rejects.toThrow("process.exit(0)");

      expect(clack.cancel).toHaveBeenCalledWith("Team mode enable cancelled");
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("cancels when user presses Ctrl+C", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false, bundle: false },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(Symbol("cancel") as any);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      await expect(team(["enable"])).rejects.toThrow("process.exit(0)");

      expect(clack.cancel).toHaveBeenCalled();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it("writes config atomically", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false, bundle: false },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await expect(team(["enable"])).rejects.toThrow("process.exit");

      // Should create directory
      expect(fs.mkdirSync).toHaveBeenCalled();

      // Should write to temp file
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      expect(writeCalls[0]?.[0]).toBe(".aligntrue/config.yaml.tmp");
      expect(writeCalls[0]?.[1]).toContain("mode: team");

      // Should rename atomically (temp → final)
      expect(fs.renameSync).toHaveBeenCalledWith(
        ".aligntrue/config.yaml.tmp",
        ".aligntrue/config.yaml",
      );
    });

    it("handles load config error", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockRejectedValue(new Error("Invalid YAML"));

      await expect(team(["enable"])).rejects.toThrow("process.exit(1)");

      expect(console.error).toHaveBeenCalledWith(
        "✗ Failed to enable team mode",
      );
    });

    it("handles write error", async () => {
      const { loadConfig } = await import("@aligntrue/core");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false, bundle: false },
        exporters: ["cursor"],
        sources: [{ type: "local", path: ".aligntrue/rules.md" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(team(["enable"])).rejects.toThrow("process.exit(1)");

      expect(console.error).toHaveBeenCalledWith(
        "✗ Failed to enable team mode",
      );
    });
  });

  describe("invalid subcommand", () => {
    it("shows error for unknown subcommand", async () => {
      await expect(team(["unknown"])).rejects.toThrow("process.exit(1)");
      expect(console.error).toHaveBeenCalledWith("Unknown subcommand: unknown");
    });
  });

  describe("approve subcommand", () => {
    it("shows error when no sources provided", async () => {
      await expect(team(["approve"])).rejects.toThrow("process.exit(1)");
      expect(console.error).toHaveBeenCalledWith("✗ No sources provided");
    });

    it("approves hash source successfully", async () => {
      const { parseAllowList, addSourceToAllowList, writeAllowList } =
        await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });
      vi.mocked(addSourceToAllowList).mockResolvedValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await team(["approve", "sha256:abc123"]);

      expect(parseAllowList).toHaveBeenCalled();
      expect(addSourceToAllowList).toHaveBeenCalledWith(
        "sha256:abc123",
        expect.any(Object),
      );
      expect(writeAllowList).toHaveBeenCalled();
    });

    it("handles multiple sources", async () => {
      const { parseAllowList, addSourceToAllowList, writeAllowList } =
        await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });
      vi.mocked(addSourceToAllowList).mockResolvedValue({
        version: 1,
        sources: [],
      });
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await team(["approve", "sha256:abc123", "sha256:def456"]);

      expect(addSourceToAllowList).toHaveBeenCalledTimes(2);
    });

    it("handles resolution failure with option to continue", async () => {
      const { parseAllowList, addSourceToAllowList, writeAllowList } =
        await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });
      vi.mocked(addSourceToAllowList)
        .mockRejectedValueOnce(new Error("Resolution failed"))
        .mockResolvedValueOnce({ version: 1, sources: [] });
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await team(["approve", "bad-source@test@v1", "sha256:abc123"]);

      expect(console.error).toHaveBeenCalledWith("  Resolution failed");
      expect(addSourceToAllowList).toHaveBeenCalledTimes(2);
    });

    it("stops on single source failure", async () => {
      const { parseAllowList, addSourceToAllowList } = await import(
        "@aligntrue/core/team/allow.js"
      );

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });
      vi.mocked(addSourceToAllowList).mockRejectedValue(
        new Error("Resolution failed"),
      );
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await expect(team(["approve", "bad-source@test@v1"])).rejects.toThrow(
        "process.exit(1)",
      );
    });

    it("handles user cancellation during multi-source failure", async () => {
      const { parseAllowList, addSourceToAllowList } = await import(
        "@aligntrue/core/team/allow.js"
      );

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });
      vi.mocked(addSourceToAllowList).mockRejectedValue(
        new Error("Resolution failed"),
      );
      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await expect(
        team(["approve", "bad1@test@v1", "sha256:abc"]),
      ).rejects.toThrow("process.exit(1)");
    });
  });

  describe("list-allowed subcommand", () => {
    it("shows empty message when no sources", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });

      await expect(team(["list-allowed"])).rejects.toThrow("process.exit(0)");
      expect(console.log).toHaveBeenCalledWith("No approved sources");
    });

    it("lists hash sources", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });

      await team(["list-allowed"]);

      expect(console.log).toHaveBeenCalledWith("Approved rule sources:");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("sha256:abc123"),
      );
    });

    it("lists id sources with resolved hashes", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [
          {
            type: "id",
            value: "base-global@aligntrue/catalog@v1.0.0",
            resolved_hash: "sha256:abc123",
          },
        ],
      });

      await team(["list-allowed"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("base-global@aligntrue/catalog@v1.0.0"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("sha256:abc123"),
      );
    });

    it("displays comments when present", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [
          {
            type: "hash",
            value: "sha256:abc123",
            comment: "Vendored pack",
          },
        ],
      });

      await team(["list-allowed"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Vendored pack"),
      );
    });

    it("shows total count", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [
          { type: "hash", value: "sha256:abc" },
          { type: "hash", value: "sha256:def" },
        ],
      });

      await team(["list-allowed"]);

      expect(console.log).toHaveBeenCalledWith("Total: 2 sources");
    });
  });

  describe("remove subcommand", () => {
    it("shows error when no sources provided", async () => {
      await expect(team(["remove"])).rejects.toThrow("process.exit(1)");
      expect(console.error).toHaveBeenCalledWith("✗ No sources provided");
    });

    it("shows message when allow list is empty", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({ version: 1, sources: [] });

      await expect(team(["remove", "sha256:abc"])).rejects.toThrow(
        "process.exit(0)",
      );
      expect(console.log).toHaveBeenCalledWith("Allow list is already empty");
    });

    it("skips non-existent source", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });

      await team(["remove", "sha256:notfound"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Source not found"),
      );
    });

    it("removes source after confirmation", async () => {
      const { parseAllowList, removeSourceFromAllowList, writeAllowList } =
        await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });
      vi.mocked(removeSourceFromAllowList).mockReturnValue({
        version: 1,
        sources: [],
      });
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await team(["remove", "sha256:abc123"]);

      expect(removeSourceFromAllowList).toHaveBeenCalledWith(
        "sha256:abc123",
        expect.any(Object),
      );
      expect(writeAllowList).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Removed"),
      );
    });

    it("skips removal when user declines", async () => {
      const { parseAllowList, removeSourceFromAllowList } = await import(
        "@aligntrue/core/team/allow.js"
      );

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await team(["remove", "sha256:abc123"]);

      expect(removeSourceFromAllowList).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Skipped"),
      );
    });

    it("handles user cancellation", async () => {
      const { parseAllowList } = await import("@aligntrue/core/team/allow.js");

      vi.mocked(parseAllowList).mockReturnValue({
        version: 1,
        sources: [{ type: "hash", value: "sha256:abc123" }],
      });
      vi.mocked(clack.confirm).mockResolvedValue(undefined as any);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      await expect(team(["remove", "sha256:abc123"])).rejects.toThrow(
        "process.exit(0)",
      );
      expect(clack.cancel).toHaveBeenCalledWith("Removal cancelled");
    });
  });
});
