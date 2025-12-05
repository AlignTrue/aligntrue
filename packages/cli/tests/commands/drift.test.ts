/**
 * Tests for drift command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { drift } from "../../src/commands/drift.js";
import * as core from "@aligntrue/core";
import * as teamDrift from "@aligntrue/core/team/drift.js";

const expectAlignTrueExit = async (
  fn: () => Promise<unknown>,
  exitCode: number,
  messageIncludes?: string,
) => {
  let error: unknown;
  try {
    await fn();
  } catch (err) {
    error = err;
  }

  expect(error).toMatchObject({
    exitCode,
    ...(messageIncludes
      ? { message: expect.stringContaining(messageIncludes) }
      : {}),
  });
};

const runDriftAllowExit = async (
  args: string[],
): Promise<{ exitCode?: number }> => {
  const originalExitCode = process.exitCode;
  process.exitCode = undefined;

  try {
    await drift(args);
    const code = process.exitCode ?? 0;
    process.exitCode = originalExitCode;
    return { exitCode: code };
  } catch (err) {
    const exitCode = (err as { exitCode?: number })?.exitCode;
    if (exitCode !== undefined) {
      process.exitCode = originalExitCode;
      return { exitCode };
    }
    process.exitCode = originalExitCode;
    throw err;
  }
};

describe("drift command", () => {
  let tempDir: string;
  let originalCwd: string;
  let consoleLogSpy: unknown;
  let consoleErrorSpy: unknown;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-cmd-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Spy on console
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  describe("help and validation", () => {
    it("shows help with --help", async () => {
      await drift(["--help"]);
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("aligntrue drift");
      expect(output).toContain("USAGE");
      expect(output).toContain("--gates");
    });

    it("errors when config not found", async () => {
      await expectAlignTrueExit(() => drift([]), 2, "Config file not found");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file not found"),
      );
    });

    it("errors when not in team mode", async () => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: solo");

      await expectAlignTrueExit(() => drift([]), 1, "requires team mode");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("requires team mode"),
      );
    });
  });

  describe("config resolution", () => {
    it("passes project root to loadMergedConfig when using default config path", async () => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team\n");

      const loadMergedConfigSpy = vi
        .spyOn(core, "loadMergedConfig")
        .mockResolvedValue({
          config: { mode: "team", exporters: {} },
          warnings: [],
          sources: { personal: true, team: false, fieldSources: new Map() },
          isTeamMode: true,
          isLegacyTeamConfig: false,
        } as never);

      const detectDriftSpy = vi
        .spyOn(teamDrift, "detectDriftForConfig")
        .mockResolvedValue({
          driftDetected: false,
          mode: "team",
          lockfilePath: ".aligntrue/lock.json",
          drift: [],
        } as never);

      await drift([]);

      expect(loadMergedConfigSpy).toHaveBeenCalledWith(process.cwd());
      expect(detectDriftSpy).toHaveBeenCalled();
    });
  });

  describe("--gates flag", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
    });

    it("exits 0 by default when drift detected", async () => {
      // Create rules directory with different content than lockfile expects
      mkdirSync(".aligntrue/rules", { recursive: true });
      writeFileSync(
        ".aligntrue/rules/test.md",
        "# Test Rule\n\nThis content differs from lockfile.",
      );

      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
            },
          ],
          bundle_hash: "different-hash-to-trigger-drift",
        }),
      );

      await expect(drift([])).resolves.toBeUndefined();
    });

    it.skip("exits 2 with --gates when drift detected", async () => {
      // Create rules directory with different content than lockfile expects
      mkdirSync(".aligntrue/rules", { recursive: true });
      writeFileSync(
        ".aligntrue/rules/test.md",
        "# Test Rule\n\nThis content differs from lockfile.",
      );

      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
            },
          ],
          bundle_hash: "different-hash-to-trigger-drift",
        }),
      );

      const result = await runDriftAllowExit(["--gates"]);
      expect(result.exitCode).toBe(2);
    });

    it("exits 0 with --gates when no drift", async () => {
      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );

      const result = await runDriftAllowExit(["--gates"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("solo mode error", () => {
    it("shows clear error message", async () => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: solo");

      try {
        await drift([]);
      } catch {
        // Expected
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("requires team mode"),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue team enable"),
      );
    });
  });

  describe("no drift scenario", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
    });

    it("shows success message", async () => {
      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("No drift detected");
    });

    it("includes mode in output", async () => {
      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Mode: team");
    });
  });

  describe("output formats", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      mkdirSync(".aligntrue/rules", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
      writeFileSync(
        ".aligntrue/rules/test.md",
        "# Test Rule\n\nDifferent content.",
      );

      writeFileSync(
        ".aligntrue/lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "test-align",
              content_hash: "abc123",
            },
          ],
          bundle_hash: "different-hash-to-trigger-drift",
        }),
      );
    });

    it("outputs JSON format with --json", async () => {
      await runDriftAllowExit(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.mode).toBe("team");
      expect(parsed.has_drift).toBe(true);
      expect(parsed.findings.length).toBeGreaterThan(0);
      expect(parsed.findings[0].category).toBe("lockfile");
      expect(parsed.summary.total).toBeGreaterThan(0);
    });

    it("includes lockfile path in JSON output", async () => {
      await runDriftAllowExit(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.lockfile_path).toBe(".aligntrue/lock.json");
    });

    it("includes summary by category in JSON", async () => {
      await runDriftAllowExit(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      // Only lockfile drift category exists now
      expect(parsed.summary.by_category.lockfile).toBeGreaterThan(0);
    });

    it("outputs SARIF format with --sarif", async () => {
      await runDriftAllowExit(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.$schema).toContain("sarif");
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0].tool.driver.name).toBe("AlignTrue Drift Detection");
      expect(parsed.runs[0].results).toHaveLength(1);
    });

    it("SARIF includes rule definitions", async () => {
      await runDriftAllowExit(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
      expect(parsed.runs[0].tool.driver.rules[0].id).toBe(
        "aligntrue/lockfile-drift",
      );
    });

    it("SARIF uses warning level by default", async () => {
      await runDriftAllowExit(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results[0].level).toBe("warning");
    });

    it("SARIF uses error level with --gates", async () => {
      await expectAlignTrueExit(
        () => drift(["--sarif", "--gates"]),
        2,
        "Drift detected",
      );

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results[0].level).toBe("error");
    });
  });
});
