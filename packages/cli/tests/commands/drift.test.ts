/**
 * Tests for drift command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { drift } from "../../src/commands/drift.js";

describe("drift command", () => {
  let tempDir: string;
  let originalCwd: string;
  let exitSpy: unknown;
  let consoleLogSpy: unknown;
  let consoleErrorSpy: unknown;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "drift-cmd-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);

    // Spy on process.exit
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as (code?: number | string | null | undefined) => never);

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
      try {
        await drift([]);
      } catch {
        // Expected
      }
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Config file not found"),
      );
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("errors when not in team mode", async () => {
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
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("upstream drift detection", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
    });

    it("detects upstream drift and shows human output", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different456
`,
      );

      await drift([]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Drift Detection Report");
      expect(output).toContain("UPSTREAM DRIFT");
      expect(output).toContain("base-global");
      expect(output).toContain("abc123".slice(0, 12));
      expect(output).toContain("different456".slice(0, 12));
      expect(output).toContain("PR for team");
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits 0 when no drift detected", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: abc123
`,
      );

      await drift([]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("No drift detected");
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("shows suggestion to accept current version", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different456
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("aligntrue update apply");
    });
  });

  describe("vendorized drift detection", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
    });

    it("detects vendorized drift", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "vendored-pack",
              content_hash: "abc123",
              vendor_path: "vendor/missing",
              vendor_type: "submodule",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources: []
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("VENDORIZED DRIFT");
      expect(output).toContain("vendored-pack");
      expect(output).toContain("vendor/missing");
      expect(output).toContain("submodule");
    });

    it("shows vendor update suggestion", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "vendored-pack",
              content_hash: "abc123",
              vendor_path: "vendor/pack",
              vendor_type: "subtree",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources: []
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("vendor/pack");
    });

    it("shows correct vendor type in output", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "vendored-pack",
              content_hash: "abc123",
              vendor_path: "vendor/pack",
              vendor_type: "subtree",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources: []
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Vendor type: subtree");
    });
  });

  describe("--gates flag", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");
    });

    it("exits 0 by default when drift detected", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different456
`,
      );

      await drift([]);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits 2 with --gates when drift detected", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different456
`,
      );

      try {
        await drift(["--gates"]);
      } catch {
        // Expected
      }
      expect(exitSpy).toHaveBeenCalledWith(2);
    });

    it("exits 0 with --gates when no drift", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: abc123
`,
      );

      try {
        await drift(["--gates"]);
      } catch {
        // Only expect error when there's drift
        throw e;
      }
      expect(exitSpy).not.toHaveBeenCalled();
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
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources: []
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain("No drift detected");
    });

    it("includes mode in output", async () => {
      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources: []
`,
      );

      await drift([]);

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Mode: team");
    });
  });

  describe("output formats", () => {
    beforeEach(() => {
      mkdirSync(".aligntrue", { recursive: true });
      writeFileSync(".aligntrue/config.yaml", "mode: team");

      writeFileSync(
        ".aligntrue.lock.json",
        JSON.stringify({
          version: "1",
          generated_at: "2025-10-29T12:00:00Z",
          mode: "team",
          rules: [
            {
              rule_id: "base-global",
              content_hash: "abc123",
              source: "git:https://github.com/org/pack",
            },
          ],
          bundle_hash: "xyz789",
        }),
      );

      writeFileSync(
        ".aligntrue/allow.yaml",
        `version: 1
sources:
  - type: id
    value: git:https://github.com/org/pack
    resolved_hash: different456
`,
      );
    });

    it("outputs JSON format with --json", async () => {
      await drift(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.mode).toBe("team");
      expect(parsed.has_drift).toBe(true);
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].category).toBe("upstream");
      expect(parsed.summary.total).toBe(1);
    });

    it("includes lockfile path in JSON output", async () => {
      await drift(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.lockfile_path).toBe(".aligntrue.lock.json");
    });

    it("includes summary by category in JSON", async () => {
      await drift(["--json"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.summary.by_category.upstream).toBe(1);
      expect(parsed.summary.by_category.vendorized).toBe(0);
    });

    it("outputs SARIF format with --sarif", async () => {
      await drift(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.version).toBe("2.1.0");
      expect(parsed.$schema).toContain("sarif");
      expect(parsed.runs).toHaveLength(1);
      expect(parsed.runs[0].tool.driver.name).toBe("AlignTrue Drift Detection");
      expect(parsed.runs[0].results).toHaveLength(1);
    });

    it("SARIF includes rule definitions", async () => {
      await drift(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].tool.driver.rules).toHaveLength(1);
      expect(parsed.runs[0].tool.driver.rules[0].id).toBe(
        "aligntrue/upstream-drift",
      );
    });

    it("SARIF uses warning level by default", async () => {
      await drift(["--sarif"]);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results[0].level).toBe("warning");
    });

    it("SARIF uses error level with --gates", async () => {
      await expect(drift(["--sarif", "--gates"])).rejects.toThrow(
        "process.exit called",
      );

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.runs[0].results[0].level).toBe("error");
    });
  });
});
