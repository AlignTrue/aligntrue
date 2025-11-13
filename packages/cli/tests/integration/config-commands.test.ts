/**
 * Integration tests for config get/set/list/unset commands
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(process.cwd(), "tests", "tmp", "config-commands-test");
const CLI_PATH = join(process.cwd(), "dist", "index.js");

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
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get mode`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("solo");
    });

    it("should get a nested value using dot notation", () => {
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get sync.edit_source`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("AGENTS.md");
    });

    it("should get an array value", () => {
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get exporters`,
        { encoding: "utf-8" },
      );
      const parsed = JSON.parse(result.trim());
      expect(parsed).toEqual(["cursor", "agents-md"]);
    });

    it("should fail with exit code 1 for non-existent key", () => {
      try {
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config get nonexistent`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Key not found");
      }
    });

    it("should fail with exit code 2 when key argument is missing", () => {
      try {
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config get`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(2);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing key argument");
      }
    });
  });

  describe("config set", () => {
    it("should set a top-level string value", () => {
      execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config set mode team`, {
        encoding: "utf-8",
      });

      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get mode`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("team");
    });

    it("should set a nested value using dot notation", () => {
      execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config set sync.auto_pull true`,
        { encoding: "utf-8" },
      );

      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get sync.auto_pull`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("true");
    });

    it("should set a boolean value", () => {
      execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config set sync.auto_pull true`,
        { encoding: "utf-8" },
      );

      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get sync.auto_pull`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("true");
    });

    it("should set a number value", () => {
      execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config set performance.max_file_size_mb 20`,
        { encoding: "utf-8" },
      );

      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get performance.max_file_size_mb`,
        { encoding: "utf-8" },
      );
      expect(result.trim()).toBe("20");
    });

    it("should fail validation for invalid mode", () => {
      try {
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config set mode invalid`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Invalid mode");
      }
    });

    it("should fail with exit code 2 when arguments are missing", () => {
      try {
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config set mode`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
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
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config list`,
        { encoding: "utf-8" },
      );

      expect(result).toContain("mode = solo");
      expect(result).toContain("exporters = ");
      expect(result).toContain("sync.edit_source = AGENTS.md");
      expect(result).toContain("sync.auto_pull = false");
    });

    it("should show all nested keys with dot notation", () => {
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config list`,
        { encoding: "utf-8" },
      );

      // Should use dot notation for nested keys
      expect(result).toContain("sync.edit_source");
      expect(result).toContain("sync.auto_pull");
    });
  });

  describe("config unset", () => {
    it("should remove an optional config value", () => {
      // First verify the value exists
      const before = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config get sync.edit_source`,
        { encoding: "utf-8" },
      );
      expect(before.trim()).toBe("AGENTS.md");

      // Unset it
      execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config unset sync.edit_source`,
        { encoding: "utf-8" },
      );

      // Verify it's gone
      try {
        execSync(
          `cd ${TEST_DIR} && node ${CLI_PATH} config get sync.edit_source`,
          { encoding: "utf-8", stdio: "pipe" },
        );
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Key not found");
      }
    });

    it("should succeed with warning when key doesn't exist", () => {
      const result = execSync(
        `cd ${TEST_DIR} && node ${CLI_PATH} config unset nonexistent.key`,
        { encoding: "utf-8", stdio: "pipe" },
      );

      expect(result).toContain("Key not found");
    });

    it("should fail with exit code 2 when key argument is missing", () => {
      try {
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config unset`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
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
        execSync(
          `cd ${TEST_DIR} && node ${CLI_PATH} config set exporters "not-an-array"`,
          { encoding: "utf-8", stdio: "pipe" },
        );
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
        execSync(`cd ${TEST_DIR} && node ${CLI_PATH} config unset mode`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect.fail("Should have thrown an error");
      } catch (err: any) {
        expect(err.status).toBe(1);
        const output = err.stdout.toString() + err.stderr.toString();
        expect(output).toContain("Missing required field: mode");
      }
    });
  });
});
