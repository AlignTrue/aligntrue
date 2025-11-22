/**
 * Sync UX Improvements Integration Tests
 * Tests for overwritten-rules system, verbosity system, and source switching
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync,
  rmSync,
  mkdtempSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  backupOverwrittenFile,
  formatTimestampForFilename,
} from "@aligntrue/core";
import {
  formatDetectionOutput,
  buildAgentSummary,
  shouldRecommendEditSourceSwitch,
  isMultiFileFormat,
} from "../../src/utils/detection-output-formatter.js";
import type { DetectedFileWithContent } from "../../src/utils/detect-agents.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
});

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe("Overwritten Rules Manager", () => {
  it("should format timestamp correctly", () => {
    // Create date with specific UTC values
    const date = new Date(Date.UTC(2025, 10, 21, 15, 30, 45));
    const formatted = formatTimestampForFilename(date);
    // Just verify format matches, don't check exact time due to timezone issues in tests
    expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    // Verify it contains year-month-day part
    expect(formatted).toContain("2025-11-21");
  });

  it("should backup a file to overwritten-rules folder with timestamp", () => {
    // Setup
    const sourceDir = join(tmpDir, "rules");
    mkdirSync(sourceDir, { recursive: true });
    const sourceFile = join(sourceDir, "AGENTS.md");
    writeFileSync(
      sourceFile,
      "# Original Rules\n\n## Test Section\nSome content",
    );

    // Execute
    const backupPath = backupOverwrittenFile(sourceFile, tmpDir);

    // Verify
    expect(existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain(".aligntrue/overwritten-rules/rules");
    expect(backupPath).toContain("AGENTS");
    expect(backupPath).toMatch(
      /AGENTS\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md/,
    );

    // Verify content
    const backed = readFileSync(backupPath, "utf-8");
    expect(backed).toContain("Original Rules");
  });

  it("should preserve directory structure when backing up nested files", () => {
    // Setup
    const sourceDir = join(tmpDir, ".cursor", "rules");
    mkdirSync(sourceDir, { recursive: true });
    const sourceFile = join(sourceDir, "debugging.mdc");
    writeFileSync(sourceFile, "# Debugging Rules");

    // Execute
    const backupPath = backupOverwrittenFile(sourceFile, tmpDir);

    // Verify directory structure is preserved
    expect(backupPath).toContain(".aligntrue/overwritten-rules/.cursor/rules");
    expect(backupPath).toContain("debugging");
    expect(existsSync(backupPath)).toBe(true);
  });
});

describe("Detection Output Formatter", () => {
  it("should identify multi-file formats correctly", () => {
    expect(isMultiFileFormat("cursor")).toBe(true);
    expect(isMultiFileFormat("amazonq")).toBe(true);
    expect(isMultiFileFormat("agents")).toBe(false);
    expect(isMultiFileFormat("claude")).toBe(false);
  });

  it("should build agent summary from files", () => {
    const files: DetectedFileWithContent[] = [
      {
        path: "/test/file1.mdc",
        relativePath: ".cursor/rules/file1.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 5,
        lastModified: new Date(),
        size: 1024,
        hasContent: true,
      },
      {
        path: "/test/file2.mdc",
        relativePath: ".cursor/rules/file2.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 3,
        lastModified: new Date(),
        size: 512,
        hasContent: true,
      },
    ];

    const summary = buildAgentSummary("cursor", "Cursor", files);

    expect(summary.agentName).toBe("cursor");
    expect(summary.displayName).toBe("Cursor");
    expect(summary.fileCount).toBe(2);
    expect(summary.totalSections).toBe(8);
    expect(summary.isMultiFile).toBe(true);
  });

  it("should format default output without verbose flag", () => {
    const files: DetectedFileWithContent[] = [
      {
        path: "/test/file1.mdc",
        relativePath: ".cursor/rules/file1.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 5,
        lastModified: new Date(),
        size: 1024,
        hasContent: true,
      },
    ];

    const summary = buildAgentSummary("cursor", "Cursor", files);
    const filesByAgent = new Map([["cursor", files]]);

    const result = formatDetectionOutput([summary], filesByAgent, {
      verbose: false,
      verboseFull: false,
    });

    expect(result.text).toContain("Detected new content");
    expect(result.text).toContain("cursor: 1 file");
    expect(result.text).toContain("Run with --verbose to see file details");
    expect(result.text).not.toContain("file1.mdc"); // Should not show file list without verbose
  });

  it("should format verbose output with top files", () => {
    const files: DetectedFileWithContent[] = [
      {
        path: "/test/file1.mdc",
        relativePath: ".cursor/rules/file1.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 10,
        lastModified: new Date(Date.now() - 3600000), // 1 hour ago
        size: 1024,
        hasContent: true,
      },
      {
        path: "/test/file2.mdc",
        relativePath: ".cursor/rules/file2.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 5,
        lastModified: new Date(),
        size: 512,
        hasContent: true,
      },
    ];

    const summary = buildAgentSummary("cursor", "Cursor", files);
    const filesByAgent = new Map([["cursor", files]]);

    const result = formatDetectionOutput([summary], filesByAgent, {
      verbose: true,
      verboseFull: false,
    });

    expect(result.text).toContain("file1.mdc");
    expect(result.text).toContain("file2.mdc");
    expect(result.text).toContain("- 10 sections");
    expect(result.text).toContain("- 5 sections");
  });

  it("should detect when edit source switch is recommended", () => {
    // Multi-file cursor detected, single-file AGENTS.md current
    const result = shouldRecommendEditSourceSwitch(["cursor"], "AGENTS.md");

    expect(result.should_recommend).toBe(true);
    expect(result.agent).toBe("cursor");
  });

  it("should not recommend switch from multi-file to single-file", () => {
    // Single-file claude detected, multi-file cursor current
    const result = shouldRecommendEditSourceSwitch(
      ["claude"],
      ".cursor/rules/*.mdc",
    );

    expect(result.should_recommend).toBe(false);
  });

  it("should not recommend switch when current source is already multi-file", () => {
    // Multi-file cursor detected, multi-file source already
    const result = shouldRecommendEditSourceSwitch(
      ["cursor"],
      ".cursor/rules/*.mdc",
    );

    expect(result.should_recommend).toBe(false);
    expect(result.reason).toContain("already multi-file");
  });

  it("should format JSON output correctly", () => {
    const files: DetectedFileWithContent[] = [
      {
        path: "/test/file1.mdc",
        relativePath: ".cursor/rules/file1.mdc",
        agent: "cursor",
        format: "cursor-mdc",
        sectionCount: 5,
        lastModified: new Date(),
        size: 1024,
        hasContent: true,
      },
    ];

    const summary = buildAgentSummary("cursor", "Cursor", files);
    const filesByAgent = new Map([["cursor", files]]);

    const result = formatDetectionOutput([summary], filesByAgent, {
      json: true,
    });

    expect(result.json).toBeDefined();
    expect(result.json?.detected).toBeDefined();
    expect(result.json?.detected?.cursor).toBeDefined();
    expect(result.json?.detected?.cursor?.files).toBe(1);
    expect(result.json?.detected?.cursor?.sections).toBe(5);
    expect(result.json?.detected?.cursor?.is_multi_file).toBe(true);
  });
});

describe("Extract Rules with Backup", () => {
  it("should export backup file function", async () => {
    const { backupFileToOverwrittenRules } = await import(
      "../../src/utils/extract-rules.js"
    );
    expect(typeof backupFileToOverwrittenRules).toBe("function");
  });

  it("should handle backup errors gracefully", async () => {
    const { backupFileToOverwrittenRules } = await import(
      "../../src/utils/extract-rules.js"
    );

    // Try to backup non-existent file
    const result = backupFileToOverwrittenRules("/nonexistent/file.md", tmpDir);

    expect(result.backed_up).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("Integration: File Overwrite Workflow", () => {
  it("should backup file when switching edit source from single to multi-file", () => {
    // Setup: Create AGENTS.md as current edit source
    const currentEditSource = join(tmpDir, "AGENTS.md");
    writeFileSync(
      currentEditSource,
      "# Current AGENTS\n\n## Section 1\nContent",
    );

    // Execute: Backup the file
    const backupPath = backupOverwrittenFile(currentEditSource, tmpDir);

    // Verify: File is backed up
    expect(existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain("overwritten-rules");
    expect(backupPath).toContain("AGENTS");

    // Verify: Content is preserved
    const backupContent = readFileSync(backupPath, "utf-8");
    expect(backupContent).toContain("Current AGENTS");
  });

  it("should support multiple backups of same file", () => {
    // Setup
    const sourceFile = join(tmpDir, "AGENTS.md");
    writeFileSync(sourceFile, "# Backup 1");

    // First backup
    const backup1 = backupOverwrittenFile(sourceFile, tmpDir);
    expect(existsSync(backup1)).toBe(true);

    // Wait to ensure different timestamp
    const start = Date.now();
    while (Date.now() - start < 1100) {
      // Wait at least 1.1 seconds to guarantee different second
    }

    // Modify file
    writeFileSync(sourceFile, "# Backup 2");

    // Second backup
    const backup2 = backupOverwrittenFile(sourceFile, tmpDir);
    expect(existsSync(backup2)).toBe(true);

    // Verify: Both exist
    expect(existsSync(backup1)).toBe(true);
    expect(existsSync(backup2)).toBe(true);

    // Verify: Each has correct content
    const content1 = readFileSync(backup1, "utf-8");
    const content2 = readFileSync(backup2, "utf-8");
    expect(content1).toContain("Backup 1");
    expect(content2).toContain("Backup 2");
  });
});
