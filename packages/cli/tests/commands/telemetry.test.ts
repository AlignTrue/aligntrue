/**
 * Tests for telemetry command
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { telemetry } from "../../src/commands/telemetry.js";
import { mockCommandArgs } from "../utils/command-test-helpers.js";
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

// Mock clack
vi.mock("@clack/prompts");

describe("telemetry command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code})`);
    });

    // Setup clack mocks
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.outro).mockImplementation(() => {});
  });

  describe("help", () => {
    it("shows help with --help flag", async () => {
      const args = mockCommandArgs({ help: true });
      await expect(telemetry(args)).rejects.toThrow("process.exit(0)");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Usage: aligntrue telemetry"),
      );
    });

    it("shows help with no args", async () => {
      await expect(telemetry([])).rejects.toThrow("process.exit(0)");
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("What we collect"),
      );
    });
  });

  describe("on", () => {
    it("enables telemetry successfully", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["on"])).rejects.toThrow("process.exit");

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("✓ Telemetry enabled");
    });

    it("creates telemetry file with enabled: true", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.renameSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["on"])).rejects.toThrow("process.exit");

      // Should write to temp file
      const writeCall = vi
        .mocked(fs.writeFileSync)
        .mock.calls.find((call) => call[0] === ".aligntrue/telemetry.json.tmp");
      expect(writeCall).toBeDefined();
      expect(writeCall?.[1]).toContain('"enabled": true');

      // Should rename atomically
      expect(fs.renameSync).toHaveBeenCalledWith(
        ".aligntrue/telemetry.json.tmp",
        ".aligntrue/telemetry.json",
      );
    });

    it("handles write error", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(telemetry(["on"])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith("Enable telemetry failed");
    });
  });

  describe("off", () => {
    it("disables telemetry successfully", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["off"])).rejects.toThrow("process.exit");

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith("✓ Telemetry disabled");
    });

    it("creates telemetry file with enabled: false", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.renameSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["off"])).rejects.toThrow("process.exit");

      // Should write to temp file
      const writeCall = vi
        .mocked(fs.writeFileSync)
        .mock.calls.find((call) => call[0] === ".aligntrue/telemetry.json.tmp");
      expect(writeCall).toBeDefined();
      expect(writeCall?.[1]).toContain('"enabled": false');

      // Should rename atomically
      expect(fs.renameSync).toHaveBeenCalledWith(
        ".aligntrue/telemetry.json.tmp",
        ".aligntrue/telemetry.json",
      );
    });

    it("handles write error", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      await expect(telemetry(["off"])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith("Disable telemetry failed");
    });
  });

  describe("status", () => {
    it("shows enabled status when file exists and enabled", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"enabled": true}');

      await expect(telemetry(["status"])).rejects.toThrow("process.exit");

      expect(console.log).toHaveBeenCalledWith("Telemetry: enabled");
    });

    it("shows disabled status when file exists and disabled", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{"enabled": false}');

      await expect(telemetry(["status"])).rejects.toThrow("process.exit");

      expect(console.log).toHaveBeenCalledWith("Telemetry: disabled");
    });

    it("shows disabled status when file does not exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(telemetry(["status"])).rejects.toThrow("process.exit");

      expect(console.log).toHaveBeenCalledWith("Telemetry: disabled");
    });

    it("defaults to disabled on parse error", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid json");

      await expect(telemetry(["status"])).rejects.toThrow("process.exit");

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Invalid telemetry.json"),
      );
      expect(console.log).toHaveBeenCalledWith("Telemetry: disabled");
    });

    it("handles read error gracefully", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Read error");
      });

      await expect(telemetry(["status"])).rejects.toThrow("process.exit(1)");
      expect(clack.log.error).toHaveBeenCalledWith(
        "Read telemetry status failed",
      );
    });
  });

  describe("atomic writes", () => {
    it("creates directory before writing", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["on"])).rejects.toThrow("process.exit");

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(".aligntrue"),
        { recursive: true },
      );
    });

    it("writes temp file then final file", async () => {
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);

      await expect(telemetry(["on"])).rejects.toThrow("process.exit");

      const writeCalls = vi.mocked(fs.writeFileSync).mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);
      expect(
        writeCalls.some((call) => call[0]?.toString().includes(".tmp")),
      ).toBe(true);
    });
  });

  describe("invalid subcommand", () => {
    it("shows error for unknown subcommand", async () => {
      await expect(telemetry(["unknown"])).rejects.toThrow("process.exit(1)");
      expect(console.error).toHaveBeenCalledWith("Unknown subcommand: unknown");
    });
  });
});
