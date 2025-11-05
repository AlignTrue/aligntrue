/**
 * Integration tests for override-status command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideStatus } from "../../src/commands/override-status.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-override-status");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Override Status Command Integration", () => {
  describe("List Overrides", () => {
    it("lists all configured overrides", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
        overlays: {
          overrides: [
            {
              selector: "rule[id=test-1]",
              set: { severity: "warn" },
            },
            {
              selector: "rule[id=test-2]",
              set: { severity: "error" },
            },
          ],
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const originalLog = console.log;
      let output = "";
      console.log = (msg: string) => {
        output += msg + "\n";
      };

      await overrideStatus([]);

      console.log = originalLog;

      expect(output).toContain("test-1");
      expect(output).toContain("test-2");
    });

    it("shows message when no overrides configured", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const originalLog = console.log;
      let output = "";
      console.log = (msg: string) => {
        output += msg + "\n";
      };

      await overrideStatus([]);

      console.log = originalLog;

      expect(output.toLowerCase()).toContain("no override");
    });
  });

  describe("JSON Output", () => {
    it("outputs overrides in JSON format with --json", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
        overlays: {
          overrides: [
            {
              selector: "rule[id=test]",
              set: { severity: "warn" },
            },
          ],
        },
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const originalLog = console.log;
      let output = "";
      console.log = (msg: string) => {
        output += msg + "\n";
      };

      await overrideStatus(["--json"]);

      console.log = originalLog;

      const parsed = JSON.parse(output);
      expect(parsed.overrides).toBeDefined();
      expect(Array.isArray(parsed.overrides)).toBe(true);
    });
  });
});
