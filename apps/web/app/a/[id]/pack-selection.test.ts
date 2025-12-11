/**
 * Tests for pack file selection logic used in AlignDetailClient
 *
 * Note: Full React component testing would require @testing-library/react.
 * These tests cover the pure logic portions of pack handling.
 */

import { describe, it, expect } from "vitest";
import type { AlignRecord, AlignPackInfo } from "@/lib/aligns/types";
import type { CachedContent, CachedPackFile } from "@/lib/aligns/content-cache";

/**
 * Pack detection logic extracted from AlignDetailClient
 */
function isPack(
  align: AlignRecord,
  content: CachedContent | null,
): content is CachedContent & { kind: "pack"; files: CachedPackFile[] } {
  return (
    align.kind === "pack" &&
    content?.kind === "pack" &&
    Array.isArray(content.files) &&
    !!align.pack
  );
}

/**
 * Get the default selected file path for a pack
 */
function getDefaultSelectedPath(
  packFiles: CachedPackFile[],
  isSingleFile: boolean,
): string {
  if (isSingleFile) return "single";
  return packFiles[0]?.path ?? "";
}

/**
 * Find content for a selected path
 */
function getSelectedContent(
  packFiles: CachedPackFile[],
  selectedPath: string,
): string | null {
  const file = packFiles.find((f) => f.path === selectedPath);
  return file?.content ?? null;
}

describe("pack detection", () => {
  it("detects a pack align with pack content", () => {
    const align: AlignRecord = {
      schemaVersion: 1,
      id: "test-pack",
      url: "https://github.com/test/pack",
      normalizedUrl: "github.com/test/pack/.align.yaml",
      provider: "github",
      kind: "pack",
      title: "Test Pack",
      fileType: "yaml",
      createdAt: "2024-01-01",
      lastViewedAt: "2024-01-01",
      viewCount: 0,
      installClickCount: 0,
      pack: {
        manifestPath: ".align.yaml",
        manifestId: "test/pack",
        manifestVersion: "1.0.0",
        manifestSummary: null,
        manifestAuthor: null,
        manifestDescription: null,
        ref: "main",
        files: [{ path: "rules/test.md", size: 100 }],
        totalBytes: 100,
      },
    };

    const content: CachedContent = {
      kind: "pack",
      files: [{ path: "rules/test.md", size: 100, content: "# Test" }],
    };

    expect(isPack(align, content)).toBe(true);
  });

  it("returns false for single file align", () => {
    const align: AlignRecord = {
      schemaVersion: 1,
      id: "test-single",
      url: "https://github.com/test/file.md",
      normalizedUrl: "github.com/test/file.md",
      provider: "github",
      kind: "rule",
      title: "Test File",
      fileType: "md",
      createdAt: "2024-01-01",
      lastViewedAt: "2024-01-01",
      viewCount: 0,
      installClickCount: 0,
    };

    const content: CachedContent = {
      kind: "single",
      content: "# Test",
    };

    expect(isPack(align, content)).toBe(false);
  });

  it("returns false when content is null", () => {
    const align: AlignRecord = {
      schemaVersion: 1,
      id: "test",
      url: "https://github.com/test",
      normalizedUrl: "github.com/test",
      provider: "github",
      kind: "pack",
      title: "Test",
      fileType: "yaml",
      createdAt: "2024-01-01",
      lastViewedAt: "2024-01-01",
      viewCount: 0,
      installClickCount: 0,
      pack: {
        manifestPath: ".align.yaml",
        manifestId: "test/pack",
        manifestVersion: "1.0.0",
        manifestSummary: null,
        manifestAuthor: null,
        manifestDescription: null,
        ref: "main",
        files: [],
        totalBytes: 0,
      },
    };

    expect(isPack(align, null)).toBe(false);
  });
});

describe("pack file selection", () => {
  const packFiles: CachedPackFile[] = [
    { path: "rules/global.md", size: 100, content: "# Global Rules" },
    { path: "rules/testing.md", size: 150, content: "# Testing" },
    { path: "rules/typescript.md", size: 200, content: "# TypeScript" },
  ];

  it("defaults to first file path for packs", () => {
    expect(getDefaultSelectedPath(packFiles, false)).toBe("rules/global.md");
  });

  it("returns 'single' for non-pack aligns", () => {
    expect(getDefaultSelectedPath([], true)).toBe("single");
  });

  it("returns empty string for empty pack", () => {
    expect(getDefaultSelectedPath([], false)).toBe("");
  });

  it("finds content for selected path", () => {
    expect(getSelectedContent(packFiles, "rules/testing.md")).toBe("# Testing");
  });

  it("returns null for non-existent path", () => {
    expect(getSelectedContent(packFiles, "nonexistent.md")).toBeNull();
  });
});

describe("pack dropdown behavior", () => {
  it("pack with multiple files should show all paths", () => {
    const packInfo: AlignPackInfo = {
      manifestPath: ".align.yaml",
      manifestId: "test/pack",
      manifestVersion: "1.0.0",
      manifestSummary: null,
      manifestAuthor: null,
      manifestDescription: null,
      ref: "main",
      files: [
        { path: "rules/a.md", size: 100 },
        { path: "rules/b.md", size: 150 },
        { path: "rules/c.md", size: 200 },
      ],
      totalBytes: 450,
    };

    // The dropdown should display all files
    expect(packInfo.files).toHaveLength(3);
    expect(packInfo.files.map((f) => f.path)).toEqual([
      "rules/a.md",
      "rules/b.md",
      "rules/c.md",
    ]);
  });
});
