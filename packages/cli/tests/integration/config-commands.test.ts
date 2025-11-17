/**
 * Integration tests for config get/set/list/unset commands
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";

const TEST_DIR = join(process.cwd(), "tests", "tmp", "config-commands-test");
const CLI_PATH = join(process.cwd(), "dist", "index.js");

/**
 * Helper to safely run CLI commands with proper path handling
 * Uses execFileSync to avoid shell injection vulnerabilities
 */
function runCli(args: string[], options: { encoding?: string } = {}): string {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd: TEST_DIR,
    encoding: options.encoding || "utf-8",
  });
}

describe("Config Commands", () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });

    // Create a basic config file
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    const _config = {
      mode: "solo",
      exporters: ["cursor", "agents-md"],
      sync: {
        edit_source: "AGENTS.md",
        auto_pull: false,
      },
    };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      `mode: solo
exporters:
  - cursor
  - agents-md
sync:
  edit_source: "AGENTS.md"
  auto_pull: false
`,
      "utf-8",
    );
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("config get", () => {
    it("should get a top-level value", () => {
      const result = runCli(["config", "get", "mode"]);
      expect(result.trim()).toBe("solo");
    });

    it("should get a nested value using dot notation", () => {
      const result = runCli(["config", "get", "sync.edit_source"]);
      expect(result.trim()).toBe("AGENTS.md");
    });

    it("should get an array value", () => {
      const result = runCli(["config", "get", "exporters"]);
      const parsed = JSON.parse(result.trim());
      expect(parsed).toEqual(["cursor", "agents-md"]);
    });

    it("should fail with exit code 1 for non-existent key", () => {
      try {
        runCli(["config", "get", "nonexistent"], {});
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Key not found");
      }
    });

    it("should fail with exit code 2 when key argument is missing", () => {
      try {
        runCli(["config", "get"], {});
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(2);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing key argument");
      }
    });
  });

  describe("config set", () => {
    it("should set a top-level string value", { timeout: 15000 }, () => {
      runCli(["config", "set", "mode", "team"]);
      const result = runCli(["config", "get", "mode"]);
      expect(result.trim()).toBe("team");
    });

    it(
      "should set a nested value using dot notation",
      { timeout: 15000 },
      () => {
        runCli(["config", "set", "sync.auto_pull", "true"]);
        const result = runCli(["config", "get", "sync.auto_pull"]);
        expect(result.trim()).toBe("true");
      },
    );

    it("should set a boolean value", () => {
      runCli(["config", "set", "sync.auto_pull", "true"]);
      const result = runCli(["config", "get", "sync.auto_pull"]);
      expect(result.trim()).toBe("true");
    });

    it("should set a number value", () => {
      runCli(["config", "set", "performance.max_file_size_mb", "20"]);
      const result = runCli(["config", "get", "performance.max_file_size_mb"]);
      expect(result.trim()).toBe("20");
    });

    it("should fail validation for invalid mode", () => {
      try {
        runCli(["config", "set", "mode", "invalid"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Invalid mode");
      }
    });

    it("should fail with exit code 2 when arguments are missing", () => {
      try {
        runCli(["config", "set", "mode"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(2);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing key or value");
      }
    });
  });

  describe("config list", () => {
    it("should list all config values", () => {
      const result = runCli(["config", "list"]);
      expect(result).toContain("mode = solo");
      expect(result).toContain("exporters = ");
      expect(result).toContain("sync.edit_source = AGENTS.md");
      expect(result).toContain("sync.auto_pull = false");
    });

    it("should show all nested keys with dot notation", () => {
      const result = runCli(["config", "list"]);
      // Should use dot notation for nested keys
      expect(result).toContain("sync.edit_source");
      expect(result).toContain("sync.auto_pull");
    });
  });

  describe("config unset", () => {
    it("should remove an optional config value", () => {
      // First verify the value exists
      const before = runCli(["config", "get", "sync.edit_source"]);
      expect(before.trim()).toBe("AGENTS.md");

      // Unset it
      runCli(["config", "unset", "sync.edit_source"]);

      // Verify it's gone
      try {
        runCli(["config", "get", "sync.edit_source"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Key not found");
      }
    });

    it("should succeed with warning when key doesn't exist", () => {
      const result = runCli(["config", "unset", "nonexistent.key"]);
      expect(result).toContain("Key not found");
    });

    it("should fail with exit code 2 when key argument is missing", () => {
      try {
        runCli(["config", "unset"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(2);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing key argument");
      }
    });
  });

  describe("config validation", () => {
    it("should validate config after set operation", () => {
      // Try to set an invalid exporters value (not an array)
      try {
        runCli(["config", "set", "exporters", "not-an-array"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("exporters must be an array");
      }
    });

    it("should validate config after unset operation", () => {
      // Try to unset a required field
      try {
        runCli(["config", "unset", "mode"]);
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing required field: mode");
      }
    });
  });
});
