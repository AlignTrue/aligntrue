/**
 * Tests for check command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";

// Mock modules before importing the command
vi.mock("@clack/prompts");

vi.mock("fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  readLockfile: vi.fn(),
  validateLockfile: vi.fn(),
  loadIR: vi.fn(() => ({ rules: [] })),
}));

vi.mock("@aligntrue/schema", () => ({
  validateAlignSchema: vi.fn(() => ({
    valid: true,
    errors: [],
  })),
  parseYamlToJson: vi.fn(),
  validateRuleId: vi.fn(() => ({ valid: true })),
}));

// Import after mocks are set up
const { check } = await import("../../src/commands/check.js");
const core = await import("@aligntrue/core");
const schema = await import("@aligntrue/schema");
const clack = await import("@clack/prompts");

describe("check command", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Setup clack mocks
    vi.mocked(clack.log).error = vi.fn();
    vi.mocked(clack.log).success = vi.fn();
    vi.mocked(clack.outro).mockImplementation(() => {});

    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("help and argument parsing", () => {
    it("shows help when --help flag is provided", async () => {
      try {
        await check(["--help"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue check"),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("shows help when -h flag is provided", async () => {
      try {
        await check(["-h"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue check"),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("requires --ci flag for now", async () => {
      try {
        await check([]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("--ci flag is required"),
      );
      expect(exitSpy).toHaveBeenCalledWith(2);
    });
  });

  describe("config validation", () => {
    it("exits with code 2 when config not found", async () => {
      vi.mocked(core.loadConfig).mockRejectedValue(
        new Error("Config file not found: .aligntrue/config.yaml"),
      );

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file not found"),
      );
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("uses custom config path when --config provided", async () => {
      vi.mocked(core.loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false },
        sources: [{ type: "local", path: ".aligntrue/rules.yaml" }],
        exporters: ["cursor"],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'id: test\nversion: "1"\nspec_version: "1"\nrules: []',
      );
      vi.mocked(schema.parseYamlToJson).mockReturnValue({
        id: "testing.example.test",
        version: "1",
        spec_version: "1",
        rules: [],
      });
      vi.mocked(schema.validateAlignSchema).mockReturnValue({
        valid: true,
        errors: [],
      });

      try {
        await check(["--ci", "--config", "custom.yaml"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(core.loadConfig).toHaveBeenCalledWith("custom.yaml");
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("rules file validation", () => {
    beforeEach(() => {
      vi.mocked(core.loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false },
        sources: [{ type: "local", path: ".aligntrue/rules.yaml" }],
        exporters: ["cursor"],
      });
    });

    it("exits with code 2 when rules file not found", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(clack.log.error).toHaveBeenCalledWith("Rules file not found");
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("exits with code 2 when rules file cannot be read", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(clack.log.error).toHaveBeenCalledWith("File write failed");
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("exits with code 1 when YAML is invalid", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue("invalid: yaml: [");
      vi.mocked(schema.parseYamlToJson).mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid YAML"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 when schema validation fails", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('id: test\nversion: "1"');
      vi.mocked(schema.parseYamlToJson).mockReturnValue({
        id: "testing.example.test",
        version: "1",
      });
      vi.mocked(schema.validateAlignSchema).mockReturnValue({
        valid: false,
        errors: [
          { path: "spec_version", message: "Missing required field" },
          { path: "rules", message: "Missing required field" },
        ],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("spec_version"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("rules"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("passes validation with valid schema", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'id: test\nversion: "1"\nspec_version: "1"\nrules: []',
      );
      vi.mocked(schema.parseYamlToJson).mockReturnValue({
        id: "testing.example.test",
        version: "1",
        spec_version: "1",
        rules: [],
      });
      vi.mocked(schema.validateAlignSchema).mockReturnValue({
        valid: true,
        errors: [],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("✓ Validation passed"),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("lockfile validation - solo mode", () => {
    beforeEach(() => {
      vi.mocked(core.loadConfig).mockResolvedValue({
        version: "1",
        mode: "solo",
        modules: { lockfile: false },
        sources: [{ type: "local", path: ".aligntrue/rules.yaml" }],
        exporters: ["cursor"],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'id: test\nversion: "1"\nspec_version: "1"\nrules: []',
      );
      vi.mocked(schema.parseYamlToJson).mockReturnValue({
        id: "testing.example.test",
        version: "1",
        spec_version: "1",
        rules: [],
      });
      vi.mocked(schema.validateAlignSchema).mockReturnValue({
        valid: true,
        errors: [],
      });
    });

    it("skips lockfile validation in solo mode", async () => {
      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(core.readLockfile).not.toHaveBeenCalled();
      expect(core.validateLockfile).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("skipped (solo mode)"),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("lockfile validation - team mode", () => {
    beforeEach(() => {
      vi.mocked(core.loadConfig).mockResolvedValue({
        version: "1",
        mode: "team",
        modules: { lockfile: true },
        sources: [{ type: "local", path: ".aligntrue/rules.yaml" }],
        exporters: ["cursor"],
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        'id: test\nversion: "1"\nspec_version: "1"\nrules: []',
      );
      vi.mocked(schema.parseYamlToJson).mockReturnValue({
        id: "testing.example.test",
        version: "1",
        spec_version: "1",
        rules: [],
      });
      vi.mocked(schema.validateAlignSchema).mockReturnValue({
        valid: true,
        errors: [],
      });
    });

    it("exits with code 1 when lockfile missing in team mode", async () => {
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (typeof path === "string" && path.includes(".aligntrue.lock.json")) {
          return false;
        }
        return true;
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("✗ Lockfile validation failed"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 on lockfile hash mismatch", async () => {
      const mockLockfile = {
        version: "1",
        generated_at: "2025-10-27T00:00:00.000Z",
        mode: "soft" as const,
        rules: [{ rule_id: "test.rule", content_hash: "abc123" }],
        bundle_hash: "bundle123",
      };

      vi.mocked(core.readLockfile).mockReturnValue(mockLockfile);
      vi.mocked(core.validateLockfile).mockReturnValue({
        valid: false,
        mismatches: [
          {
            rule_id: "test.rule",
            expected_hash: "abc123",
            actual_hash: "def456",
          },
        ],
        newRules: [],
        deletedRules: [],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("✗ Lockfile drift detected"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("test.rule"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 when new rules detected", async () => {
      const mockLockfile = {
        version: "1",
        generated_at: "2025-10-27T00:00:00.000Z",
        mode: "soft" as const,
        rules: [],
        bundle_hash: "bundle123",
      };

      vi.mocked(core.readLockfile).mockReturnValue(mockLockfile);
      vi.mocked(core.validateLockfile).mockReturnValue({
        valid: false,
        mismatches: [],
        newRules: ["test.rule.new"],
        deletedRules: [],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("New rules not in lockfile"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("test.rule.new"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("exits with code 1 when deleted rules detected", async () => {
      const mockLockfile = {
        version: "1",
        generated_at: "2025-10-27T00:00:00.000Z",
        mode: "soft" as const,
        rules: [{ rule_id: "test.rule.deleted", content_hash: "abc123" }],
        bundle_hash: "bundle123",
      };

      vi.mocked(core.readLockfile).mockReturnValue(mockLockfile);
      vi.mocked(core.validateLockfile).mockReturnValue({
        valid: false,
        mismatches: [],
        newRules: [],
        deletedRules: ["test.rule.deleted"],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rules in lockfile but not in IR"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("test.rule.deleted"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("passes validation when lockfile matches", async () => {
      const mockLockfile = {
        version: "1",
        generated_at: "2025-10-27T00:00:00.000Z",
        mode: "soft" as const,
        rules: [{ rule_id: "test.rule", content_hash: "abc123" }],
        bundle_hash: "bundle123",
      };

      vi.mocked(core.readLockfile).mockReturnValue(mockLockfile);
      vi.mocked(core.validateLockfile).mockReturnValue({
        valid: true,
        mismatches: [],
        newRules: [],
        deletedRules: [],
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validation passed"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("matches current rules"),
      );
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it("exits with code 2 on lockfile read error", async () => {
      vi.mocked(core.readLockfile).mockImplementation(() => {
        throw new Error("Failed to parse lockfile");
      });

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("✗ Lockfile validation failed"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse lockfile"),
      );
      expect(exitSpy).toHaveBeenCalledWith(2);
    });
  });

  describe("error handling", () => {
    it("exits with code 2 on unexpected system error", async () => {
      vi.mocked(core.loadConfig).mockRejectedValue(
        new Error("Unexpected filesystem error"),
      );

      try {
        await check(["--ci"]);
      } catch (err) {
        // Expected: process.exit throws in tests
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("System error"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unexpected filesystem error"),
      );
      expect(exitSpy).toHaveBeenCalledWith(2);
    });
  });
});
