/**
 * Integration tests for override-remove command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideRemove } from "../../src/commands/override-remove.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-override-remove");

beforeEach(() => {
  vi.clearAllMocks();

  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Override Remove Command Integration", () => {
  describe("Basic Removal", () => {
    it("removes override by index", async () => {
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

      try {
        await overrideRemove(["rule[id=test-1]"]);
      } catch (e) {
        // May throw from process.exit if command fails
      }

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe(
        "rule[id=test-2]",
      );
    });
  });

  describe("Error Handling", () => {
    it("exits with error if no overrides exist", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = { exporters: ["cursor"] };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      let threwExpectedError = false;
      try {
        await overrideRemove(["0"]);
      } catch (e) {
        // Expected to throw from process.exit mock
        if (e instanceof Error && e.message.includes("process.exit")) {
          threwExpectedError = true;
        }
      }

      expect(threwExpectedError).toBe(true);
    });
  });
});
