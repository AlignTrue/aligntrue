import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  isLikelyBinary,
  checkPackSize,
  checkPreviewSize,
  scanForBinaries,
  checkCatalogBudget,
  checkCatalogSize,
  runPackAbuseControls,
  LIMITS,
} from "./abuse-controls.js";

const TEST_DIR = ".test-abuse-controls";

describe("Abuse Controls", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("isLikelyBinary", () => {
    it("detects empty file as not binary", () => {
      const path = join(TEST_DIR, "empty.txt");
      writeFileSync(path, "");
      expect(isLikelyBinary(path)).toBe(false);
    });

    it("detects plain text as not binary", () => {
      const path = join(TEST_DIR, "text.txt");
      writeFileSync(path, "Hello world\nThis is plain text\n");
      expect(isLikelyBinary(path)).toBe(false);
    });

    it("detects YAML as not binary", () => {
      const path = join(TEST_DIR, "pack.yaml");
      writeFileSync(path, "id: test\nversion: 1.0.0\nrules:\n  - id: rule-1\n");
      expect(isLikelyBinary(path)).toBe(false);
    });

    it("detects file with null bytes as binary", () => {
      const path = join(TEST_DIR, "binary.bin");
      const buffer = Buffer.from([0x48, 0x65, 0x00, 0x6c, 0x6c, 0x6f]); // "He\0llo"
      writeFileSync(path, buffer);
      expect(isLikelyBinary(path)).toBe(true);
    });

    it("detects file with many non-printable chars as binary", () => {
      const path = join(TEST_DIR, "binary2.bin");
      // Create buffer with 50% non-printable characters
      const buffer = Buffer.alloc(100);
      for (let i = 0; i < 50; i++) {
        buffer[i] = 0x01; // Non-printable
      }
      for (let i = 50; i < 100; i++) {
        buffer[i] = 0x41; // 'A'
      }
      writeFileSync(path, buffer);
      expect(isLikelyBinary(path)).toBe(true);
    });

    it("handles missing file gracefully", () => {
      const path = join(TEST_DIR, "nonexistent.txt");
      expect(isLikelyBinary(path)).toBe(false);
    });
  });

  describe("checkPackSize", () => {
    it("passes for small pack", () => {
      const path = join(TEST_DIR, "small.yaml");
      writeFileSync(path, "id: test\nversion: 1.0.0\n");
      const violation = checkPackSize(path);
      expect(violation).toBeNull();
    });

    it("passes for pack at limit", () => {
      const path = join(TEST_DIR, "limit.yaml");
      const size = LIMITS.MAX_PACK_SIZE;
      const content = "x".repeat(size);
      writeFileSync(path, content);
      const violation = checkPackSize(path);
      expect(violation).toBeNull();
    });

    it("fails for pack exceeding limit (>1MB)", () => {
      const path = join(TEST_DIR, "huge.yaml");
      const size = LIMITS.MAX_PACK_SIZE + 1000;
      const content = "x".repeat(size);
      writeFileSync(path, content);
      const violation = checkPackSize(path);
      expect(violation).not.toBeNull();
      expect(violation?.type).toBe("size");
      expect(violation?.actual).toBeGreaterThan(LIMITS.MAX_PACK_SIZE);
      expect(violation?.limit).toBe(LIMITS.MAX_PACK_SIZE);
      expect(violation?.message).toContain("1MB");
    });

    it("handles missing file gracefully", () => {
      const path = join(TEST_DIR, "nonexistent.yaml");
      const violation = checkPackSize(path);
      expect(violation).toBeNull();
    });
  });

  describe("checkPreviewSize", () => {
    it("passes for small preview", () => {
      const content = "# Small preview\n";
      const violation = checkPreviewSize(content, "yaml");
      expect(violation).toBeNull();
    });

    it("passes for preview at limit", () => {
      const content = "x".repeat(LIMITS.MAX_PREVIEW_SIZE);
      const violation = checkPreviewSize(content, "yaml");
      expect(violation).toBeNull();
    });

    it("fails for preview exceeding limit (>512KB)", () => {
      const content = "x".repeat(LIMITS.MAX_PREVIEW_SIZE + 1000);
      const violation = checkPreviewSize(content, "yaml");
      expect(violation).not.toBeNull();
      expect(violation?.type).toBe("size");
      expect(violation?.message).toContain("yaml");
      expect(violation?.actual).toBeGreaterThan(LIMITS.MAX_PREVIEW_SIZE);
      expect(violation?.message).toContain("0MB"); // Should show 0.50MB or similar
    });

    it("includes format in error message", () => {
      const content = "x".repeat(LIMITS.MAX_PREVIEW_SIZE + 1000);
      const violation = checkPreviewSize(content, "cursor");
      expect(violation?.message).toContain("cursor");
    });
  });

  describe("scanForBinaries", () => {
    it("finds no binaries in empty directory", () => {
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(0);
    });

    it("finds no binaries with only text files", () => {
      writeFileSync(join(TEST_DIR, "test.yaml"), "id: test\n");
      writeFileSync(join(TEST_DIR, "readme.md"), "# README\n");
      writeFileSync(join(TEST_DIR, "config.json"), '{"key":"value"}\n');
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(0);
    });

    it("detects binary file", () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "binary.bin"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe("binary");
      expect(violations[0].message).toContain("binary.bin");
    });

    it("detects multiple binaries", () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "binary1.bin"), buffer);
      writeFileSync(join(TEST_DIR, "binary2.dat"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(2);
    });

    it("scans subdirectories", () => {
      const subdir = join(TEST_DIR, "subdir");
      mkdirSync(subdir);
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(subdir, "binary.bin"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(1);
      expect(violations[0].path).toContain("subdir");
    });

    it("excludes .git directory", () => {
      const gitDir = join(TEST_DIR, ".git");
      mkdirSync(gitDir);
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(gitDir, "binary.bin"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(0);
    });

    it("excludes node_modules directory", () => {
      const nmDir = join(TEST_DIR, "node_modules");
      mkdirSync(nmDir);
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(nmDir, "binary.bin"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(0);
    });

    it("respects custom exclude patterns", () => {
      const customDir = join(TEST_DIR, "custom");
      mkdirSync(customDir);
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(customDir, "binary.bin"), buffer);
      const violations = scanForBinaries(TEST_DIR, ["custom"]);
      expect(violations).toHaveLength(0);
    });

    it("skips known text extensions even if heuristic fails", () => {
      // Create a file with .yaml extension but binary content
      // (should skip due to extension)
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "fake.yaml"), buffer);
      const violations = scanForBinaries(TEST_DIR);
      expect(violations).toHaveLength(0);
    });
  });

  describe("checkCatalogBudget", () => {
    it("passes for empty catalog", () => {
      const violation = checkCatalogBudget(TEST_DIR);
      expect(violation).toBeNull();
    });

    it("passes for catalog under budget", () => {
      // Create 1MB file
      const content = "x".repeat(1024 * 1024);
      writeFileSync(join(TEST_DIR, "file.txt"), content);
      const violation = checkCatalogBudget(TEST_DIR);
      expect(violation).toBeNull();
    });

    it("fails for catalog exceeding budget", () => {
      // Create multiple files totaling > 500MB
      // Use smaller test to avoid huge files in tests
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore - temporarily override for test
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file1.txt"), "x".repeat(60));
      writeFileSync(join(TEST_DIR, "file2.txt"), "x".repeat(60));

      const violation = checkCatalogBudget(TEST_DIR);

      // @ts-ignore - restore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(violation).not.toBeNull();
      expect(violation?.type).toBe("budget");
      expect(violation?.actual).toBeGreaterThan(100);
    });

    it("includes subdirectory sizes", () => {
      const subdir = join(TEST_DIR, "subdir");
      mkdirSync(subdir);
      writeFileSync(join(TEST_DIR, "file1.txt"), "x".repeat(100));
      writeFileSync(join(subdir, "file2.txt"), "x".repeat(100));

      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 150;

      const violation = checkCatalogBudget(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(violation).not.toBeNull();
      expect(violation?.actual).toBeGreaterThan(150);
    });
  });

  describe("checkCatalogSize", () => {
    it("returns size info for empty catalog", () => {
      const result = checkCatalogSize(TEST_DIR);
      expect(result.totalSize).toBe(0);
      expect(result.percentUsed).toBe(0);
      expect(result.violation).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it("returns size info under warning threshold", () => {
      // Create file at 40% of budget (under 50% threshold)
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file.txt"), "x".repeat(40));
      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.totalSize).toBe(40);
      expect(result.percentUsed).toBeCloseTo(0.4);
      expect(result.violation).toBeUndefined();
      expect(result.warning).toBeUndefined();
    });

    it("returns warning at 50% threshold", () => {
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file.txt"), "x".repeat(50));
      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.totalSize).toBe(50);
      expect(result.percentUsed).toBe(0.5);
      expect(result.violation).toBeUndefined();
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("50%");
      expect(result.warning).toContain("threshold");
    });

    it("returns warning above 50% threshold", () => {
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file.txt"), "x".repeat(75));
      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.totalSize).toBe(75);
      expect(result.percentUsed).toBe(0.75);
      expect(result.violation).toBeUndefined();
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain("75.0%");
    });

    it("returns violation at 100% limit", () => {
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file.txt"), "x".repeat(101));
      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.totalSize).toBe(101);
      expect(result.percentUsed).toBeGreaterThan(1.0);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe("budget");
      expect(result.warning).toBeUndefined(); // Violation takes precedence
    });

    it("calculates percentage correctly for multiple files", () => {
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 1000;

      const subdir = join(TEST_DIR, "subdir");
      mkdirSync(subdir);
      writeFileSync(join(TEST_DIR, "file1.txt"), "x".repeat(300));
      writeFileSync(join(subdir, "file2.txt"), "x".repeat(200));

      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.totalSize).toBe(500);
      expect(result.percentUsed).toBe(0.5);
      expect(result.warning).toBeDefined();
    });

    it("provides actionable warning message", () => {
      const oldLimit = LIMITS.MAX_CATALOG_SIZE;
      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = 100;

      writeFileSync(join(TEST_DIR, "file.txt"), "x".repeat(60));
      const result = checkCatalogSize(TEST_DIR);

      // @ts-ignore
      LIMITS.MAX_CATALOG_SIZE = oldLimit;

      expect(result.warning).toContain("Consider increasing catalog budget");
      expect(result.warning).toContain("removing old packs");
    });
  });

  describe("runPackAbuseControls", () => {
    it("returns no violations for valid pack", () => {
      const packPath = join(TEST_DIR, "pack.yaml");
      writeFileSync(packPath, "id: test\nversion: 1.0.0\n");
      const violations = runPackAbuseControls(packPath, TEST_DIR);
      expect(violations).toHaveLength(0);
    });

    it("detects pack size violation", () => {
      const packPath = join(TEST_DIR, "huge.yaml");
      const content = "x".repeat(LIMITS.MAX_PACK_SIZE + 1000);
      writeFileSync(packPath, content);
      const violations = runPackAbuseControls(packPath, TEST_DIR);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.type === "size")).toBe(true);
    });

    it("detects binary files when packDir provided", () => {
      const packPath = join(TEST_DIR, "pack.yaml");
      writeFileSync(packPath, "id: test\n");
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "binary.bin"), buffer);
      const violations = runPackAbuseControls(packPath, TEST_DIR);
      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.type === "binary")).toBe(true);
    });

    it("skips binary scan when packDir not provided", () => {
      const packPath = join(TEST_DIR, "pack.yaml");
      writeFileSync(packPath, "id: test\n");
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "binary.bin"), buffer);
      const violations = runPackAbuseControls(packPath); // No packDir
      expect(violations).toHaveLength(0);
    });

    it("returns multiple violations", () => {
      const packPath = join(TEST_DIR, "huge.yaml");
      const content = "x".repeat(LIMITS.MAX_PACK_SIZE + 1000);
      writeFileSync(packPath, content);
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      writeFileSync(join(TEST_DIR, "binary.bin"), buffer);
      const violations = runPackAbuseControls(packPath, TEST_DIR);
      expect(violations.length).toBeGreaterThan(1);
    });
  });

  describe("LIMITS constants", () => {
    it("exports MAX_PACK_SIZE (1MB)", () => {
      expect(LIMITS.MAX_PACK_SIZE).toBe(1 * 1024 * 1024);
    });

    it("exports MAX_PREVIEW_SIZE (512KB)", () => {
      expect(LIMITS.MAX_PREVIEW_SIZE).toBe(512 * 1024);
    });

    it("exports MAX_CATALOG_SIZE (500MB)", () => {
      expect(LIMITS.MAX_CATALOG_SIZE).toBe(500 * 1024 * 1024);
    });

    it("exports CATALOG_WARNING_THRESHOLD (50%)", () => {
      expect(LIMITS.CATALOG_WARNING_THRESHOLD).toBe(0.5);
    });
  });
});
