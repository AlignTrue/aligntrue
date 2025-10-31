/**
 * Tests for patch file writer (Phase 3.5, Session 4)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmdirSync, readdirSync } from "fs";
import { join } from "path";
import {
  writePatchFile,
  listPatchFiles,
  deletePatchFile,
} from "../../src/overlays/patch-writer.js";
import type { MergeConflict } from "../../src/overlays/merge.js";

const TEST_ARTIFACTS_DIR = ".aligntrue/test-artifacts";

describe("writePatchFile", () => {
  beforeEach(() => {
    // Clean up test artifacts directory
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  it("writes patch file to artifacts directory", () => {
    const conflicts: MergeConflict[] = [
      {
        type: "modified",
        selector: "rule[id=test]",
        propertyPath: "severity",
        baseValue: "warning",
        overlayValue: "error",
        newBaseValue: "critical",
        description: "Test conflict",
      },
    ];

    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const result = writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
    });

    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(existsSync(result.path!)).toBe(true);
  });

  it("creates artifacts directory if not exists", () => {
    expect(existsSync(TEST_ARTIFACTS_DIR)).toBe(false);

    const conflicts: MergeConflict[] = [];
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const result = writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
    });

    expect(result.success).toBe(true);
    expect(existsSync(TEST_ARTIFACTS_DIR)).toBe(true);
  });

  it("uses custom filename when provided", () => {
    const conflicts: MergeConflict[] = [];
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const result = writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      filename: "custom-patch.md",
    });

    expect(result.success).toBe(true);
    expect(result.path).toContain("custom-patch.md");
    expect(existsSync(result.path!)).toBe(true);
  });

  it("includes source in patch metadata", () => {
    const conflicts: MergeConflict[] = [
      {
        type: "modified",
        selector: "rule[id=test]",
        propertyPath: "value",
        description: "Test",
      },
    ];

    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const result = writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      source: "github.com/example/pack",
    });

    expect(result.success).toBe(true);

    // Read file and check for source
    const { readFileSync } = require("fs");
    const content = readFileSync(result.path!, "utf-8");
    expect(content).toContain("# Source: github.com/example/pack");
  });

  // Skip on Windows: chmod read-only behavior is inconsistent across Windows versions
  (process.platform === "win32" ? it.skip : it)(
    "handles write errors gracefully",
    () => {
      const { chmodSync } = require("fs");

      // Create artifacts dir and make it read-only to trigger write error
      mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });
      chmodSync(TEST_ARTIFACTS_DIR, 0o444);

      const conflicts: MergeConflict[] = [];
      const metadata = {
        baseHash: "abc123",
        newBaseHash: "def456",
        timestamp: "2025-10-30T12:00:00Z",
      };

      const result = writePatchFile(conflicts, metadata, {
        artifactsDir: TEST_ARTIFACTS_DIR,
        filename: "test-error.md",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Clean up - restore permissions first
      chmodSync(TEST_ARTIFACTS_DIR, 0o755);
    },
  );
});

describe("listPatchFiles", () => {
  beforeEach(() => {
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  it("returns empty array when directory does not exist", () => {
    const files = listPatchFiles(TEST_ARTIFACTS_DIR);
    expect(files).toEqual([]);
  });

  it("lists patch files in directory", () => {
    // Create directory and files
    mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });

    const conflicts: MergeConflict[] = [];
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      filename: "merge-conflicts-1.md",
    });
    writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      filename: "merge-conflicts-2.md",
    });

    const files = listPatchFiles(TEST_ARTIFACTS_DIR);
    expect(files).toHaveLength(2);
    expect(files[0]).toContain("merge-conflicts-");
  });

  it("filters non-patch files", () => {
    mkdirSync(TEST_ARTIFACTS_DIR, { recursive: true });

    const { writeFileSync } = require("fs");
    writeFileSync(join(TEST_ARTIFACTS_DIR, "other-file.txt"), "content");

    const conflicts: MergeConflict[] = [];
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      filename: "merge-conflicts-1.md",
    });

    const files = listPatchFiles(TEST_ARTIFACTS_DIR);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("merge-conflicts-1.md");
  });
});

describe("deletePatchFile", () => {
  beforeEach(() => {
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  afterEach(() => {
    if (existsSync(TEST_ARTIFACTS_DIR)) {
      const files = readdirSync(TEST_ARTIFACTS_DIR);
      for (const file of files) {
        deletePatchFile(join(TEST_ARTIFACTS_DIR, file));
      }
      rmdirSync(TEST_ARTIFACTS_DIR);
    }
  });

  it("deletes existing patch file", () => {
    const conflicts: MergeConflict[] = [];
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const writeResult = writePatchFile(conflicts, metadata, {
      artifactsDir: TEST_ARTIFACTS_DIR,
      filename: "test-patch.md",
    });

    expect(existsSync(writeResult.path!)).toBe(true);

    const deleted = deletePatchFile(writeResult.path!);
    expect(deleted).toBe(true);
    expect(existsSync(writeResult.path!)).toBe(false);
  });

  it("returns false for non-existent file", () => {
    const deleted = deletePatchFile("/path/to/nonexistent/file.md");
    expect(deleted).toBe(false);
  });
});
