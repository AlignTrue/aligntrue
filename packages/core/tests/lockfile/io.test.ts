import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readLockfile, writeLockfile } from "../../src/lockfile/io.js";
import { generateLockfile } from "../../src/lockfile/generator.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import type { AlignPack } from "@aligntrue/schema";
import type { Lockfile } from "../../src/lockfile/types.js";

describe("lockfile I/O", () => {
  const testDir = join(process.cwd(), "packages/core/tests/lockfile/temp");
  const lockfilePath = join(testDir, ".aligntrue.lock.json");

  const mockPack: AlignPack = {
    id: "test.pack",
    version: "1.0.0",
    spec_version: "1",
    summary: "Test pack",
    owner: "test-org",
    source: "https://github.com/test-org/aligns",
    source_sha: "abc123",
    rules: [
      {
        id: "test.rule.one",
        severity: "error",
        applies_to: ["*.ts"],
        guidance: "Test rule",
      },
    ],
  };

  beforeEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("writeLockfile", () => {
    it("writes lockfile to disk", () => {
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, lockfile);

      expect(existsSync(lockfilePath)).toBe(true);
    });

    it("creates parent directory if missing", () => {
      const nestedPath = join(testDir, "nested/dir/.aligntrue.lock.json");
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(nestedPath, lockfile);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it("formats JSON with 2-space indent", () => {
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, lockfile);

      const content = readFileSync(lockfilePath, "utf8");
      const lines = content.split("\n");

      // Check indentation
      expect(lines.some((line) => line.startsWith('  "version"'))).toBe(true);
    });

    it("adds trailing newline", () => {
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, lockfile);

      const content = readFileSync(lockfilePath, "utf8");
      expect(content.endsWith("\n")).toBe(true);
    });

    it("sorts JSON keys", () => {
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, lockfile);

      const content = readFileSync(lockfilePath, "utf8");
      const lines = content.split("\n");

      // Find positions of keys
      const bundleHashLine = lines.findIndex((l) =>
        l.includes('"bundle_hash"'),
      );
      const generatedAtLine = lines.findIndex((l) =>
        l.includes('"generated_at"'),
      );
      const modeLine = lines.findIndex((l) => l.includes('"mode"'));
      const rulesLine = lines.findIndex((l) => l.includes('"rules"'));
      const versionLine = lines.findIndex((l) => l.includes('"version"'));

      // Keys should be alphabetically sorted
      expect(bundleHashLine).toBeLessThan(generatedAtLine);
      expect(generatedAtLine).toBeLessThan(modeLine);
      expect(modeLine).toBeLessThan(rulesLine);
      expect(rulesLine).toBeLessThan(versionLine);
    });

    it("overwrites existing file", () => {
      const lockfile1 = generateLockfile(mockPack, "team");
      const lockfile2 = generateLockfile(
        {
          ...mockPack,
          rules: [{ ...mockPack.rules[0], guidance: "Modified" }],
        },
        "team",
      );

      writeLockfile(lockfilePath, lockfile1);
      writeLockfile(lockfilePath, lockfile2);

      const read = readLockfile(lockfilePath);
      expect(read?.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("uses atomic write (temp+rename)", () => {
      const lockfile = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, lockfile);

      // After successful write, temp file should not exist
      const tempPath = `${lockfilePath}.tmp`;
      expect(existsSync(tempPath)).toBe(false);
    });

    it("throws on write errors", () => {
      const lockfile = generateLockfile(mockPack, "team");
      // Use a path that will definitely fail on all platforms
      // On Windows: invalid drive letter, On Unix: root with no permissions
      const invalidPath =
        process.platform === "win32"
          ? "Z:\\nonexistent\\path\\.aligntrue.lock.json"
          : "/root/nonexistent/.aligntrue.lock.json";

      expect(() => {
        writeLockfile(invalidPath, lockfile);
      }).toThrow(); // Will throw ENOENT, EACCES, or similar error
    });
  });

  describe("readLockfile", () => {
    it("reads lockfile from disk", () => {
      const original = generateLockfile(mockPack, "team");
      writeLockfile(lockfilePath, original);

      const read = readLockfile(lockfilePath);

      expect(read).not.toBeNull();
      expect(read?.version).toBe("1");
      expect(read?.mode).toBe("team");
      expect(read?.rules).toHaveLength(1);
      expect(read?.bundle_hash).toBe(original.bundle_hash);
    });

    it("returns null for missing file", () => {
      const read = readLockfile(join(testDir, "nonexistent.lock.json"));

      expect(read).toBeNull();
    });

    it("throws on invalid JSON", () => {
      const invalidJsonPath = join(testDir, "invalid.lock.json");
      mkdirSync(testDir, { recursive: true });
      require("fs").writeFileSync(invalidJsonPath, "{ invalid json }", "utf8");

      expect(() => {
        readLockfile(invalidJsonPath);
      }).toThrow(/Failed to read lockfile/);
    });

    it("throws on invalid structure", () => {
      const invalidStructurePath = join(testDir, "invalid-structure.lock.json");
      mkdirSync(testDir, { recursive: true });
      require("fs").writeFileSync(
        invalidStructurePath,
        JSON.stringify({ foo: "bar" }),
        "utf8",
      );

      expect(() => {
        readLockfile(invalidStructurePath);
      }).toThrow(/Invalid lockfile structure/);
    });

    it("preserves all lockfile fields", () => {
      const original = generateLockfile(mockPack, "team");
      writeLockfile(lockfilePath, original);

      const read = readLockfile(lockfilePath);

      expect(read?.version).toBe(original.version);
      expect(read?.mode).toBe(original.mode);
      expect(read?.generated_at).toBe(original.generated_at);
      expect(read?.bundle_hash).toBe(original.bundle_hash);
      expect(read?.rules).toEqual(original.rules);
    });
  });

  describe("round-trip", () => {
    it("maintains data integrity", () => {
      const original = generateLockfile(mockPack, "team");

      writeLockfile(lockfilePath, original);
      const read = readLockfile(lockfilePath);

      expect(read).toEqual(original);
    });

    it("handles multiple rules", () => {
      const packWithMultipleRules: AlignPack = {
        ...mockPack,
        rules: [
          mockPack.rules[0],
          { ...mockPack.rules[0], id: "test.rule.two" },
          { ...mockPack.rules[0], id: "test.rule.three" },
        ],
      };
      const original = generateLockfile(packWithMultipleRules, "team");

      writeLockfile(lockfilePath, original);
      const read = readLockfile(lockfilePath);

      expect(read?.rules).toHaveLength(3);
      expect(read?.rules).toEqual(original.rules);
    });
  });
});
