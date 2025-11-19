/**
 * Tests for file size detection utility
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import {
  analyzeFileSize,
  analyzeFiles,
  getLargeFiles,
  formatFileSizeWarning,
  formatFileSizeWarnings,
  countLines,
  DEFAULT_THRESHOLDS,
  type FileSizeThresholds,
} from "../../src/utils/file-size-detector.js";

const TEST_DIR = join(process.cwd(), "temp-test-file-size");

describe("file-size-detector", () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("countLines", () => {
    it("counts lines in a file", () => {
      const filePath = join(TEST_DIR, "test.md");
      writeFileSync(filePath, "line 1\nline 2\nline 3\n", "utf-8");

      const count = countLines(filePath);
      expect(count).toBe(4); // 3 lines + empty line after last newline
    });

    it("handles file without trailing newline", () => {
      const filePath = join(TEST_DIR, "test.md");
      writeFileSync(filePath, "line 1\nline 2\nline 3", "utf-8");

      const count = countLines(filePath);
      expect(count).toBe(3);
    });

    it("returns 0 for non-existent file", () => {
      const count = countLines(join(TEST_DIR, "nonexistent.md"));
      expect(count).toBe(0);
    });

    it("handles empty file", () => {
      const filePath = join(TEST_DIR, "empty.md");
      writeFileSync(filePath, "", "utf-8");

      const count = countLines(filePath);
      expect(count).toBe(1); // Empty file has 1 line
    });
  });

  describe("analyzeFileSize", () => {
    it("marks file as ok when below warning threshold", () => {
      const filePath = join(TEST_DIR, "small.md");
      const content = Array.from({ length: 500 }, (_, i) => `line ${i}`).join(
        "\n",
      );
      writeFileSync(filePath, content, "utf-8");

      const analysis = analyzeFileSize(filePath, "small.md");

      expect(analysis.severity).toBe("ok");
      expect(analysis.isLarge).toBe(false);
      expect(analysis.isVeryLarge).toBe(false);
      expect(analysis.recommendation).toBeNull();
    });

    it("marks file as warning when exceeds warning threshold", () => {
      const filePath = join(TEST_DIR, "large.md");
      const content = Array.from({ length: 1100 }, (_, i) => `line ${i}`).join(
        "\n",
      );
      writeFileSync(filePath, content, "utf-8");

      const analysis = analyzeFileSize(filePath, "large.md");

      expect(analysis.severity).toBe("warning");
      expect(analysis.isLarge).toBe(true);
      expect(analysis.isVeryLarge).toBe(false);
      expect(analysis.recommendation).toContain("Consider splitting");
      expect(analysis.recommendation).toContain("aligntrue sources split");
    });

    it("marks file as urgent when exceeds urgent threshold", () => {
      const filePath = join(TEST_DIR, "very-large.md");
      const content = Array.from({ length: 1600 }, (_, i) => `line ${i}`).join(
        "\n",
      );
      writeFileSync(filePath, content, "utf-8");

      const analysis = analyzeFileSize(filePath, "very-large.md");

      expect(analysis.severity).toBe("urgent");
      expect(analysis.isLarge).toBe(true);
      expect(analysis.isVeryLarge).toBe(true);
      expect(analysis.recommendation).toContain("Strongly recommend");
      expect(analysis.recommendation).toContain("aligntrue sources split");
    });

    it("uses custom thresholds", () => {
      const filePath = join(TEST_DIR, "test.md");
      const content = Array.from({ length: 600 }, (_, i) => `line ${i}`).join(
        "\n",
      );
      writeFileSync(filePath, content, "utf-8");

      const customThresholds: FileSizeThresholds = {
        warning: 500,
        urgent: 1000,
      };

      const analysis = analyzeFileSize(filePath, "test.md", customThresholds);

      expect(analysis.severity).toBe("warning");
      expect(analysis.isLarge).toBe(true);
    });

    it("includes line count and byte size", () => {
      const filePath = join(TEST_DIR, "test.md");
      const content = "line 1\nline 2\nline 3";
      writeFileSync(filePath, content, "utf-8");

      const analysis = analyzeFileSize(filePath, "test.md");

      expect(analysis.lineCount).toBe(3);
      expect(analysis.byteSize).toBeGreaterThan(0);
    });
  });

  describe("analyzeFiles", () => {
    it("analyzes multiple files", () => {
      const file1 = join(TEST_DIR, "small.md");
      const file2 = join(TEST_DIR, "large.md");

      writeFileSync(
        file1,
        Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n"),
        "utf-8",
      );
      writeFileSync(
        file2,
        Array.from({ length: 1100 }, (_, i) => `line ${i}`).join("\n"),
        "utf-8",
      );

      const analyses = analyzeFiles([
        { path: file1, relativePath: "small.md" },
        { path: file2, relativePath: "large.md" },
      ]);

      expect(analyses).toHaveLength(2);
      expect(analyses[0]!.severity).toBe("ok");
      expect(analyses[1]!.severity).toBe("warning");
    });
  });

  describe("getLargeFiles", () => {
    it("returns files exceeding warning threshold", () => {
      const analyses = [
        {
          path: "/test/small.md",
          relativePath: "small.md",
          lineCount: 500,
          byteSize: 5000,
          isLarge: false,
          isVeryLarge: false,
          severity: "ok" as const,
          recommendation: null,
        },
        {
          path: "/test/large.md",
          relativePath: "large.md",
          lineCount: 1100,
          byteSize: 11000,
          isLarge: true,
          isVeryLarge: false,
          severity: "warning" as const,
          recommendation: "Consider splitting",
        },
      ];

      const largeFiles = getLargeFiles(analyses);

      expect(largeFiles).toHaveLength(1);
      expect(largeFiles[0]!.relativePath).toBe("large.md");
    });

    it("returns only urgent files when includeWarnings is false", () => {
      const analyses = [
        {
          path: "/test/large.md",
          relativePath: "large.md",
          lineCount: 1100,
          byteSize: 11000,
          isLarge: true,
          isVeryLarge: false,
          severity: "warning" as const,
          recommendation: "Consider splitting",
        },
        {
          path: "/test/very-large.md",
          relativePath: "very-large.md",
          lineCount: 1600,
          byteSize: 16000,
          isLarge: true,
          isVeryLarge: true,
          severity: "urgent" as const,
          recommendation: "Strongly recommend",
        },
      ];

      const urgentFiles = getLargeFiles(analyses, false);

      expect(urgentFiles).toHaveLength(1);
      expect(urgentFiles[0]!.relativePath).toBe("very-large.md");
    });
  });

  describe("formatFileSizeWarning", () => {
    it("formats warning severity with lightbulb icon", () => {
      const analysis = {
        path: "/test/large.md",
        relativePath: "large.md",
        lineCount: 1100,
        byteSize: 11000,
        isLarge: true,
        isVeryLarge: false,
        severity: "warning" as const,
        recommendation: "Consider splitting for easier management",
      };

      const formatted = formatFileSizeWarning(analysis);

      expect(formatted).toContain("💡");
      expect(formatted).toContain("large.md");
      expect(formatted).toContain("Consider splitting");
    });

    it("formats urgent severity with warning icon", () => {
      const analysis = {
        path: "/test/very-large.md",
        relativePath: "very-large.md",
        lineCount: 1600,
        byteSize: 16000,
        isLarge: true,
        isVeryLarge: true,
        severity: "urgent" as const,
        recommendation: "Strongly recommend splitting",
      };

      const formatted = formatFileSizeWarning(analysis);

      expect(formatted).toContain("⚠️");
      expect(formatted).toContain("very-large.md");
      expect(formatted).toContain("Strongly recommend");
    });
  });

  describe("formatFileSizeWarnings", () => {
    it("returns empty string when no large files", () => {
      const analyses = [
        {
          path: "/test/small.md",
          relativePath: "small.md",
          lineCount: 500,
          byteSize: 5000,
          isLarge: false,
          isVeryLarge: false,
          severity: "ok" as const,
          recommendation: null,
        },
      ];

      const formatted = formatFileSizeWarnings(analyses);

      expect(formatted).toBe("");
    });

    it("formats single large file", () => {
      const analyses = [
        {
          path: "/test/large.md",
          relativePath: "large.md",
          lineCount: 1100,
          byteSize: 11000,
          isLarge: true,
          isVeryLarge: false,
          severity: "warning" as const,
          recommendation: "Consider splitting",
        },
      ];

      const formatted = formatFileSizeWarnings(analyses);

      expect(formatted).toContain("Your rule file is getting large");
      expect(formatted).toContain("large.md");
      expect(formatted).toContain("1100 lines");
      expect(formatted).toContain("aligntrue sources split");
    });

    it("formats multiple large files", () => {
      const analyses = [
        {
          path: "/test/large1.md",
          relativePath: "large1.md",
          lineCount: 1100,
          byteSize: 11000,
          isLarge: true,
          isVeryLarge: false,
          severity: "warning" as const,
          recommendation: "Consider splitting",
        },
        {
          path: "/test/large2.md",
          relativePath: "large2.md",
          lineCount: 1200,
          byteSize: 12000,
          isLarge: true,
          isVeryLarge: false,
          severity: "warning" as const,
          recommendation: "Consider splitting",
        },
      ];

      const formatted = formatFileSizeWarnings(analyses);

      expect(formatted).toContain("2 rule files are getting large");
      expect(formatted).toContain("large1.md");
      expect(formatted).toContain("large2.md");
    });

    it("limits display to maxDisplay files", () => {
      const analyses = Array.from({ length: 10 }, (_, i) => ({
        path: `/test/large${i}.md`,
        relativePath: `large${i}.md`,
        lineCount: 1100 + i * 100,
        byteSize: 11000 + i * 1000,
        isLarge: true,
        isVeryLarge: false,
        severity: "warning" as const,
        recommendation: "Consider splitting",
      }));

      const formatted = formatFileSizeWarnings(analyses, 3);

      expect(formatted).toContain("10 rule files are getting large");
      expect(formatted).toContain("large0.md");
      expect(formatted).toContain("large1.md");
      expect(formatted).toContain("large2.md");
      expect(formatted).toContain("... and 7 more");
    });
  });
});
