/**
 * Tests for duplicate content bug fix
 * Verifies that multiple sync runs produce identical output without accumulation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "crypto";
import { AgentsMdExporter } from "../src/agents-md/index.js";
import type {
  ScopedExportRequest,
  ExportOptions,
} from "@aligntrue/plugin-contracts";
import type { AlignSection, AlignPack } from "@aligntrue/schema";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Generate a stable fingerprint for tests
 */
function generateFingerprint(heading: string, content: string): string {
  const combined = `${heading}::${content}`;
  return createHash("sha256").update(combined).digest("hex").substring(0, 16);
}

describe("Duplicate content bug fix", () => {
  let tempDir: string;
  let exporter: AgentsMdExporter;

  const testSection: AlignSection = {
    heading: "test.rule.one",
    level: 2,
    content: "Test guidance for rule one",
    fingerprint: generateFingerprint(
      "test.rule.one",
      "Test guidance for rule one",
    ),
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
    const sections = [testSection];
    const request: ScopedExportRequest = {
      scope: defaultScope,
      pack: {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        sections,
      },
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
    const sections = [testSection];
    const request: ScopedExportRequest = {
      scope: defaultScope,
      pack: {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        sections,
      },
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

    // Should have duplicate sections (this demonstrates the bug)
    const sectionMatches = contentAfterTwo.match(/## test\.rule\.one/g);
    expect(sectionMatches).toHaveLength(2); // Bug: section appears twice!

    // Third sync WITHOUT reset
    await exporter.export(request, options);

    const contentAfterThree = readFileSync(join(tempDir, "AGENTS.md"), "utf-8");

    const sectionMatches2 = contentAfterThree.match(/## test\.rule\.one/g);
    expect(sectionMatches2).toHaveLength(3); // Bug: section appears three times!
  });

  it("should not have duplicate HTML comment tags", async () => {
    const sections = [testSection];
    const request: ScopedExportRequest = {
      scope: defaultScope,
      pack: {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        sections,
      } as AlignPack,
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

    // Check for duplicate section headings
    const sectionHeadings = content.match(/## test\.rule\.one/g);

    // Should have exactly one heading per section
    expect(sectionHeadings).toHaveLength(1);
  });

  it("should handle multiple sections without duplication", async () => {
    const sections: AlignSection[] = [
      {
        heading: "test.rule.one",
        level: 2,
        content: "First rule",
        fingerprint: generateFingerprint("test.rule.one", "First rule"),
      },
      {
        heading: "test.rule.two",
        level: 2,
        content: "Second rule",
        fingerprint: generateFingerprint("test.rule.two", "Second rule"),
      },
      {
        heading: "test.rule.three",
        level: 2,
        content: "Third rule",
        fingerprint: generateFingerprint("test.rule.three", "Third rule"),
      },
    ];

    const request: ScopedExportRequest = {
      scope: defaultScope,
      pack: {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        sections,
      } as AlignPack,
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

    // Each section should appear exactly once
    expect(content.match(/## test\.rule\.one/g)).toHaveLength(1);
    expect(content.match(/## test\.rule\.two/g)).toHaveLength(1);
    expect(content.match(/## test\.rule\.three/g)).toHaveLength(1);
  });
});
