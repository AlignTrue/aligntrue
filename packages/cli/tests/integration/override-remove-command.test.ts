/**
 * Integration tests for override-remove command
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { overrideRemove } from "../../src/commands/override-remove.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-override-remove-"));
  process.chdir(TEST_DIR);

  // Mock TTY to enable interactive mode for tests
  (process.stdin as any).isTTY = true;
  (process.stdout as any).isTTY = true;

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
  // Restore TTY mocks
  delete (process.stdin as any).isTTY;
  delete (process.stdout as any).isTTY;

  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Override Remove Command Integration", () => {
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
        await overrideRemove(["rule[id=test-1]", "--force"]);
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

    it("supports --selector flag in non-interactive mode", async () => {
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

      (process.stdin as any).isTTY = false;
      (process.stdout as any).isTTY = false;

      try {
        await overrideRemove(["--selector", "rule[id=test-2]", "--force"]);
      } catch {
        // process.exit mocked to throw on failure
      } finally {
        (process.stdin as any).isTTY = true;
        (process.stdout as any).isTTY = true;
      }

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      expect(updatedConfig.overlays.overrides).toHaveLength(1);
      expect(updatedConfig.overlays.overrides[0].selector).toBe(
        "rule[id=test-1]",
      );
    });

    it("removes all overlays with --all --force", async () => {
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
        await overrideRemove(["--all", "--force"]);
      } catch {
        // process.exit mocked to throw on failure
      }

      const updatedConfig = yaml.parse(
        readFileSync(join(TEST_DIR, ".aligntrue", "config.yaml"), "utf-8"),
      );

      // When all overlays are removed, the overlays key may be omitted from minimal config
      // (since there are no overrides), or present but empty
      expect(
        !updatedConfig.overlays ||
          (Array.isArray(updatedConfig.overlays.overrides) &&
            updatedConfig.overlays.overrides.length === 0),
      ).toBe(true);
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

    it("shows helpful error when selector missing in non-interactive mode", async () => {
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
      const config = {
        exporters: ["cursor"],
        overlays: {
          overrides: [
            {
              selector: "rule[id=test-1]",
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

      (process.stdin as any).isTTY = false;
      (process.stdout as any).isTTY = false;

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(overrideRemove([])).rejects.toThrow(/process\.exit\(1\)/);

      expect(
        errorSpy.mock.calls.some((call) =>
          String(call[0]).includes("Selector argument required"),
        ),
      ).toBe(true);
      expect(
        errorSpy.mock.calls.some((call) =>
          String(call[0]).includes("aligntrue override remove 'sections[0]'"),
        ),
      ).toBe(true);

      errorSpy.mockRestore();
    });
  });
});
