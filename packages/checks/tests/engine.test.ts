/**
 * Tests for the main checks engine
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runChecks } from "../src/engine.js";
import { MemoryFileProvider } from "./providers/memory.js";
import type { AlignPack } from "@aligntrue/schema";

describe("runChecks", () => {
  const createPack = (overrides: Partial<AlignPack> = {}): AlignPack => ({
    id: "test/pack",
    version: "1.0.0",
    profile: "align",
    spec_version: "1",
    summary: "Test pack",
    tags: ["test"],
    deps: [],
    scope: {
      applies_to: ["*"],
    },
    rules: [],
    integrity: {
      algo: "jcs-sha256",
      value: "abc123",
    },
    ...overrides,
  });

  it("runs all checks in a pack", async () => {
    const provider = new MemoryFileProvider();
    provider.addFiles({
      "src/foo.test.ts": "test content",
      "package.json": JSON.stringify({ dependencies: { lodash: "4.17.21" } }),
      "pnpm-lock.yaml": "lock content",
    });

    const pack = createPack({
      rules: [
        {
          id: "require-tests",
          severity: "error",
          check: {
            type: "file_presence",
            inputs: { pattern: "**/*.test.ts" },
            evidence: "Missing tests",
          },
        },
        {
          id: "pinned-deps",
          severity: "error",
          check: {
            type: "manifest_policy",
            inputs: {
              manifest: "package.json",
              lockfile: "pnpm-lock.yaml",
              require_pinned: true,
            },
            evidence: "Unpinned dependency",
          },
        },
      ],
    });

    const results = await runChecks(pack, { fileProvider: provider });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.pass)).toBe(true);
  });

  it("delegates to correct runner based on check type", async () => {
    const provider = new MemoryFileProvider();
    provider.addFiles({
      "src/Button.tsx": "component",
      "src/foo.ts": "TODO: fix this",
    });

    const pack = createPack({
      rules: [
        {
          id: "kebab-case",
          severity: "warn",
          check: {
            type: "path_convention",
            inputs: {
              pattern: "^[a-z-]+\\.tsx$",
              include: ["src/**/*.tsx"],
              message: "Use kebab-case",
            },
            evidence: "Convention violation",
          },
        },
        {
          id: "no-todos",
          severity: "warn",
          check: {
            type: "regex",
            inputs: {
              include: ["src/**/*.ts"],
              pattern: "\\bTODO\\b",
              allow: false,
            },
            evidence: "TODO found",
          },
        },
      ],
    });

    const results = await runChecks(pack, { fileProvider: provider });

    expect(results).toHaveLength(2);
    expect(results[0].pass).toBe(false); // Button.tsx violates convention
    expect(results[1].pass).toBe(false); // foo.ts has TODO
  });

  it("respects allowExec option for command checks", async () => {
    const provider = new MemoryFileProvider();

    const pack = createPack({
      rules: [
        {
          id: "typecheck",
          severity: "error",
          check: {
            type: "command_runner",
            inputs: {
              command: 'echo "test"',
            },
            evidence: "Typecheck failed",
          },
        },
      ],
    });

    // Without allowExec
    const resultsDisallowed = await runChecks(pack, {
      fileProvider: provider,
      allowExec: false,
    });

    expect(resultsDisallowed[0].pass).toBe(false);
    expect(resultsDisallowed[0].findings[0].message).toContain("not allowed");

    // With allowExec
    const resultsAllowed = await runChecks(pack, {
      fileProvider: provider,
      allowExec: true,
    });

    expect(resultsAllowed[0].pass).toBe(true);
  });

  it("passes changed files to checks", async () => {
    const provider = new MemoryFileProvider();
    provider.addFiles({
      "src/foo.ts": "source",
      "src/foo.test.ts": "test",
      "src/bar.ts": "source without test",
    });

    const pack = createPack({
      rules: [
        {
          id: "require-tests",
          severity: "error",
          check: {
            type: "file_presence",
            inputs: {
              pattern: "**/*.test.ts",
              must_exist_for_changed_sources: true,
            },
            evidence: "Missing test",
          },
        },
      ],
    });

    const results = await runChecks(pack, {
      fileProvider: provider,
      changedFiles: ["src/bar.ts"],
    });

    expect(results[0].pass).toBe(false);
    expect(results[0].findings[0].location.path).toBe("src/bar.ts");
  });

  it("returns results for empty pack", async () => {
    const provider = new MemoryFileProvider();
    const pack = createPack({ rules: [] });

    const results = await runChecks(pack, { fileProvider: provider });

    expect(results).toHaveLength(0);
  });

  it("handles unknown check types gracefully", async () => {
    const provider = new MemoryFileProvider();
    const pack = createPack({
      rules: [
        {
          id: "unknown-check",
          severity: "error",
          check: {
            // @ts-expect-error - testing unknown type
            type: "unknown_type",
            inputs: {},
            evidence: "Unknown check",
          },
        },
      ],
    });

    const results = await runChecks(pack, { fileProvider: provider });

    expect(results[0].pass).toBe(false);
    expect(results[0].error).toContain("Unknown check type");
  });

  describe("severity remapping", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "test-remap-checks-"));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("applies remaps in team mode", async () => {
      // Write team.yaml to temp directory
      writeFileSync(
        join(tempDir, ".aligntrue.team.yaml"),
        `severity_remaps:
  - rule_id: "test-rule"
    from: "MUST"
    to: "warn"
`,
      );

      const provider = new MemoryFileProvider();
      provider.addFiles({
        "test.txt": "test",
      });

      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error", // IR: MUST → error
            check: {
              type: "file_presence",
              inputs: { pattern: "missing.txt" },
              evidence: "File not found",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        workingDir: tempDir,
        mode: "team",
      });

      expect(results[0].pass).toBe(false);
      expect(results[0].findings[0].severity).toBe("warn");
      expect(results[0].metadata?.originalSeverity).toBe("MUST");
      expect(results[0].metadata?.remappedSeverity).toBe("warn");
    });

    it("does not apply remaps in solo mode", async () => {
      // Write team.yaml to temp directory
      writeFileSync(
        join(tempDir, ".aligntrue.team.yaml"),
        `severity_remaps:
  - rule_id: "test-rule"
    from: "MUST"
    to: "warn"
`,
      );

      const provider = new MemoryFileProvider();
      provider.addFiles({
        "test.txt": "test",
      });

      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error", // IR uses error/warn/info
            check: {
              type: "file_presence",
              inputs: { pattern: "missing.txt" },
              evidence: "File not found",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        workingDir: tempDir,
        mode: "solo",
      });

      expect(results[0].pass).toBe(false);
      expect(results[0].findings[0].severity).toBe("error"); // No remap in solo mode
      expect(results[0].metadata).toBeUndefined();
    });

    it("handles missing team.yaml file gracefully", async () => {
      // Don't write team.yaml file

      const provider = new MemoryFileProvider();
      provider.addFiles({
        "test.txt": "test",
      });

      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error", // IR uses error/warn/info
            check: {
              type: "file_presence",
              inputs: { pattern: "missing.txt" },
              evidence: "File not found",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        workingDir: tempDir,
        mode: "team",
      });

      expect(results[0].pass).toBe(false);
      expect(results[0].findings[0].severity).toBe("error"); // No remap applied
      expect(results[0].metadata).toBeUndefined();
    });

    it("applies multiple remaps to different rules", async () => {
      // Write team.yaml to temp directory
      writeFileSync(
        join(tempDir, ".aligntrue.team.yaml"),
        `severity_remaps:
  - rule_id: "rule-1"
    from: "MUST"
    to: "warn"
  - rule_id: "rule-2"
    from: "SHOULD"
    to: "info"
`,
      );

      const provider = new MemoryFileProvider();
      provider.addFiles({
        "test.txt": "test",
      });

      const pack = createPack({
        rules: [
          {
            id: "rule-1",
            severity: "error", // IR: MUST → error
            check: {
              type: "file_presence",
              inputs: { pattern: "missing1.txt" },
              evidence: "File 1 not found",
            },
          },
          {
            id: "rule-2",
            severity: "warn", // IR: SHOULD → warn
            check: {
              type: "file_presence",
              inputs: { pattern: "missing2.txt" },
              evidence: "File 2 not found",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        workingDir: tempDir,
        mode: "team",
      });

      expect(results[0].findings[0].severity).toBe("warn");
      expect(results[0].metadata?.originalSeverity).toBe("MUST");
      expect(results[1].findings[0].severity).toBe("info");
      expect(results[1].metadata?.originalSeverity).toBe("SHOULD");
    });

    it("does not remap when severity does not change", async () => {
      // Write team.yaml to temp directory
      writeFileSync(
        join(tempDir, ".aligntrue.team.yaml"),
        `severity_remaps:
  - rule_id: "test-rule"
    from: "MUST"
    to: "error"
`,
      );

      const provider = new MemoryFileProvider();
      provider.addFiles({
        "test.txt": "test",
      });

      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error", // IR uses error/warn/info
            check: {
              type: "file_presence",
              inputs: { pattern: "missing.txt" },
              evidence: "File not found",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        workingDir: tempDir,
        mode: "team",
      });

      expect(results[0].findings[0].severity).toBe("error");
      expect(results[0].metadata).toBeUndefined(); // No metadata when no change
    });
  });

  describe("unresolved plugs integration", () => {
    it("should add informational finding for unresolved plugs", async () => {
      const provider = new MemoryFileProvider();
      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error",
            check: {
              type: "file_presence",
              inputs: { pattern: "*.md" },
              evidence: "No markdown files",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        unresolvedPlugsCount: 3,
      });

      // Should have original rule + plugs finding
      expect(results).toHaveLength(2);

      const plugsFinding = results.find(
        (r) => r.rule.id === "plugs/unresolved-required",
      );
      expect(plugsFinding).toBeDefined();
      expect(plugsFinding?.level).toBe("note");
      expect(plugsFinding?.message).toContain("3 required plugs need values");
      expect(plugsFinding?.message).toContain("aln plugs audit");
    });

    it("should not add finding when unresolvedPlugsCount is zero", async () => {
      const provider = new MemoryFileProvider();
      const pack = createPack({
        rules: [],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        unresolvedPlugsCount: 0,
      });

      expect(results).toHaveLength(0);
    });

    it("should not add finding when unresolvedPlugsCount is undefined", async () => {
      const provider = new MemoryFileProvider();
      const pack = createPack({
        rules: [],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
      });

      expect(results).toHaveLength(0);
    });

    it("should use singular form for one unresolved plug", async () => {
      const provider = new MemoryFileProvider();
      const pack = createPack({ rules: [] });

      const results = await runChecks(pack, {
        fileProvider: provider,
        unresolvedPlugsCount: 1,
      });

      const plugsFinding = results.find(
        (r) => r.rule.id === "plugs/unresolved-required",
      );
      expect(plugsFinding?.message).toContain("1 required plug needs values");
    });

    it("should work with severity remapping in team mode", async () => {
      const provider = new MemoryFileProvider();
      const pack = createPack({
        rules: [
          {
            id: "test-rule",
            severity: "error",
            check: {
              type: "file_presence",
              inputs: { pattern: "*.md" },
              evidence: "No markdown files",
            },
          },
        ],
      });

      const results = await runChecks(pack, {
        fileProvider: provider,
        unresolvedPlugsCount: 2,
        mode: "team",
      });

      // Should still have both findings in team mode
      expect(results.length).toBeGreaterThanOrEqual(2);
      const plugsFinding = results.find(
        (r) => r.rule.id === "plugs/unresolved-required",
      );
      expect(plugsFinding).toBeDefined();
    });
  });
});
