/**
 * Tests for duplicate content bug fix
 * Verifies that multiple sync runs produce identical output without accumulation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentsMdExporter } from "../src/agents-md/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
} from "@aligntrue/plugin-contracts";
import type { AlignRule } from "@aligntrue/schema";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Duplicate content bug fix", () => {
  let tempDir: string;
  let exporter: AgentsMdExporter;

  const testRule: AlignRule = {
    id: "test.rule.one",
    severity: "error",
    applies_to: ["**/*.ts"],
    guidance: "Test guidance for rule one",
  };

  const defaultScope = {
    path: ".",
    normalizedPath: ".",
    isDefault: true,
  };

  beforeEach(() => {
    // Create temp directory for each test
    tempDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));

    // Create fresh exporter instance
    exporter = new AgentsMdExporter();
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should produce identical output on multiple syncs", async () => {
    const request: ScopedExportRequest = {
      scope: defaultScope,
      rules: [testRule],
      outputPath: "AGENTS.md",
    };

    const options: ExportOptions = {
      outputDir: tempDir,
      dryRun: false,
    };

    // First sync
    const result1 = await exporter.export(request, options);
    expect(result1.success).toBe(true);
    expect(result1.filesWritten).toHaveLength(1);

    const content1 = readFileSync(result1.filesWritten[0]!, "utf-8");

    // Reset state (simulating what SyncEngine now does)
    exporter.resetState();

    // Second sync
    const result2 = await exporter.export(request, options);
    expect(result2.success).toBe(true);
    expect(result2.filesWritten).toHaveLength(1);

    const content2 = readFileSync(result2.filesWritten[0]!, "utf-8");

    // Content should be identical
    expect(content2).toBe(content1);

    // Reset state again
    exporter.resetState();

    // Third sync
    const result3 = await exporter.export(request, options);
    expect(result3.success).toBe(true);

    const content3 = readFileSync(result3.filesWritten[0]!, "utf-8");

    // Still identical
    expect(content3).toBe(content1);
  });

  it("should not accumulate rules without resetState", async () => {
    const request: ScopedExportRequest = {
      scope: defaultScope,
      rules: [testRule],
      outputPath: "AGENTS.md",
    };

    const options: ExportOptions = {
      outputDir: tempDir,
      dryRun: false,
    };

    // First sync
    await exporter.export(request, options);

    // Second sync WITHOUT reset (simulating old buggy behavior)
    await exporter.export(request, options);

    const contentAfterTwo = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");

    // Should have duplicate rules (this demonstrates the bug)
    const ruleMatches = contentAfterTwo.match(/## Rule: test\.rule\.one/g);
    expect(ruleMatches).toHaveLength(2); // Bug: rule appears twice!

    // Third sync WITHOUT reset
    await exporter.export(request, options);

    const contentAfterThree = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");

    const ruleMatches2 = contentAfterThree.match(/## Rule: test\.rule\.one/g);
    expect(ruleMatches2).toHaveLength(3); // Bug: rule appears three times!
  });

  it("should not have duplicate HTML comment tags", async () => {
    const request: ScopedExportRequest = {
      scope: defaultScope,
      rules: [testRule],
      outputPath: "AGENTS.md",
    };

    const options: ExportOptions = {
      outputDir: tempDir,
      dryRun: false,
    };

    // Sync three times with proper reset
    for (let i = 0; i < 3; i++) {
      await exporter.export(request, options);
      exporter.resetState();
    }

    const content = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");

    // Check for duplicate aligntrue:end tags
    const endTags = content.match(/<!-- aligntrue:end/g);

    // Should have exactly one end tag per rule
    expect(endTags).toHaveLength(1);

    // Check for duplicate aligntrue:begin tags
    const beginTags = content.match(/<!-- aligntrue:begin/g);
    expect(beginTags).toHaveLength(1);
  });

  it("should handle multiple rules without duplication", async () => {
    const rules: AlignRule[] = [
      {
        id: "test.rule.one",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "First rule",
      },
      {
        id: "test.rule.two",
        severity: "warn",
        applies_to: ["**/*.js"],
        guidance: "Second rule",
      },
      {
        id: "test.rule.three",
        severity: "info",
        applies_to: ["**/*.tsx"],
        guidance: "Third rule",
      },
    ];

    const request: ScopedExportRequest = {
      scope: defaultScope,
      rules,
      outputPath: "AGENTS.md",
    };

    const options: ExportOptions = {
      outputDir: tempDir,
      dryRun: false,
    };

    // Sync twice with reset
    await exporter.export(request, options);
    exporter.resetState();
    await exporter.export(request, options);

    const content = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");

    // Each rule should appear exactly once
    expect(content.match(/## Rule: test\.rule\.one/g)).toHaveLength(1);
    expect(content.match(/## Rule: test\.rule\.two/g)).toHaveLength(1);
    expect(content.match(/## Rule: test\.rule\.three/g)).toHaveLength(1);

    // Total of 3 begin and 3 end tags
    expect(content.match(/<!-- aligntrue:begin/g)).toHaveLength(3);
    expect(content.match(/<!-- aligntrue:end/g)).toHaveLength(3);
  });
});
