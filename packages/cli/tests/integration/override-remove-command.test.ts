/**
 * Integration tests for override-remove command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideRemove } from "../../src/commands/override-remove.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

vi.mock("@clack/prompts");

const TEST_DIR = join(tmpdir(), "aligntrue-test-override-remove");

beforeEach(() => {
  vi.clearAllMocks();

  cleanupDir(TEST_DIR);
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

afterEach(() => {
  cleanupDir(TEST_DIR);
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
      } catch {
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

      const consoleLogSpy = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      try {
        await overrideRemove(["0"]);
      } catch {
        // Not expected - should handle gracefully
      }

      // Verify command handles no overrides gracefully
      expect(consoleLogSpy).toHaveBeenCalledWith("No overlays configured");
    });
  });
});
