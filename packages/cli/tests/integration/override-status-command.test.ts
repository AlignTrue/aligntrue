/**
 * Integration tests for override-status command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideStatus } from "../../src/commands/override-status.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

vi.mock("@clack/prompts");

const TEST_DIR = join(tmpdir(), "aligntrue-test-override-status");

beforeEach(async () => {
  vi.clearAllMocks();

  await cleanupDir(TEST_DIR);
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts to avoid terminal interaction
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
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

      try {
        await overrideStatus([]);
      } catch {
        // May throw from process.exit if command fails
      }

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

      try {
        await overrideStatus([]);
      } catch {
        // May throw from process.exit if command fails
      }

      console.log = originalLog;

      expect(output.toLowerCase()).toContain("no overlays");
    });
  });

  describe("JSON Output", () => {
    it.skip("outputs overrides in JSON format with --json", async () => {
      // TODO: Fix JSON output test - currently failing due to console.log mocking issues
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

      try {
        await overrideStatus(["--json"]);
      } catch {
        // May throw from process.exit if command fails
      }

      console.log = originalLog;

      const parsed = JSON.parse(output);
      expect(parsed.overrides).toBeDefined();
      expect(Array.isArray(parsed.overrides)).toBe(true);
    });
  });
});
