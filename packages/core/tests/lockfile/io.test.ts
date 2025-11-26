import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readLockfile, writeLockfile } from "../../src/lockfile/io.js";
import { generateLockfile } from "../../src/lockfile/generator.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import type { Align } from "@aligntrue/schema";

describe("lockfile I/O", () => {
  const testDir = join(process.cwd(), "packages/core/tests/lockfile/temp");
  const lockfilePath = join(testDir, ".aligntrue.lock.json");

  const mockAlign: Align = {
    id: "test.align",
    version: "1.0.0",
    spec_version: "1",
    summary: "Test align",
    owner: "test-org",
    source: "https://github.com/test-org/aligns",
    source_sha: "abc123",
    sections: [
      {
        heading: "Test Rule",
        level: 2,
        content: "Test rule guidance",
        fingerprint: "test-rule-one",
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
      const lockfile = generateLockfile(mockAlign, "team");

      writeLockfile(lockfilePath, lockfile);

      expect(existsSync(lockfilePath)).toBe(true);
    });

    it("creates parent directory if missing", () => {
      const nestedPath = join(testDir, "nested/dir/.aligntrue.lock.json");
      const lockfile = generateLockfile(mockAlign, "team");

      writeLockfile(nestedPath, lockfile);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it("formats JSON with 2-space indent", () => {
      const lockfile = generateLockfile(mockAlign, "team");

      writeLockfile(lockfilePath, lockfile);

      const content = readFileSync(lockfilePath, "utf8");
      const lines = content.split("\n");

      // Check indentation
      expect(lines.some((line) => line.startsWith('  "version"'))).toBe(true);
    });

    it("adds trailing newline", () => {
      const lockfile = generateLockfile(mockAlign, "team");

      writeLockfile(lockfilePath, lockfile);

      const content = readFileSync(lockfilePath, "utf8");
      expect(content.endsWith("\n")).toBe(true);
    });

    it("sorts JSON keys", () => {
      const lockfile = generateLockfile(mockAlign, "team");

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
      const lockfile1 = generateLockfile(mockAlign, "team");
      const lockfile2 = generateLockfile(
        {
          ...mockAlign,
          sections: [{ ...mockAlign.sections[0], guidance: "Modified" }],
        },
        "team",
      );

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      writeLockfile(lockfilePath, lockfile1);
      writeLockfile(lockfilePath, lockfile2);

      warnSpy.mockRestore();

      const read = readLockfile(lockfilePath);
      expect(read?.bundle_hash).toBe(lockfile2.bundle_hash);
    });

    it("only shows migration warning once and writes marker", () => {
      const lockfile1 = generateLockfile(mockAlign, "team");
      const lockfile2 = generateLockfile(
        {
          ...mockAlign,
          sections: [
            {
              ...mockAlign.sections[0],
              fingerprint: "second-rule",
              heading: "Second Rule",
            },
          ],
        },
        "team",
      );

      // Seed lockfile with first version
      writeLockfile(lockfilePath, lockfile1);

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // First migration should warn and create marker
      writeLockfile(lockfilePath, lockfile2);
      expect(
        warnSpy.mock.calls.some((call) =>
          call[0]?.includes(
            "Lockfile regenerated with corrected hash computation",
          ),
        ),
      ).toBe(true);
      const markerPath = join(
        testDir,
        ".aligntrue",
        ".cache",
        "lockfile-hash-migration.json",
      );
      expect(existsSync(markerPath)).toBe(true);

      warnSpy.mockClear();

      // Subsequent differences should not warn again
      writeLockfile(lockfilePath, lockfile1);
      expect(
        warnSpy.mock.calls.some((call) =>
          call[0]?.includes(
            "Lockfile regenerated with corrected hash computation",
          ),
        ),
      ).toBe(false);

      warnSpy.mockRestore();
    });

    it("uses atomic write (temp+rename)", () => {
      const lockfile = generateLockfile(mockAlign, "team");

      writeLockfile(lockfilePath, lockfile);

      // After successful write, temp file should not exist
      const tempPath = `${lockfilePath}.tmp`;
      expect(existsSync(tempPath)).toBe(false);
    });

    it("throws on write errors", () => {
      const lockfile = generateLockfile(mockAlign, "team");
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
      const original = generateLockfile(mockAlign, "team");
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
      const original = generateLockfile(mockAlign, "team");
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
      const original = generateLockfile(mockAlign, "team");

      writeLockfile(lockfilePath, original);
      const read = readLockfile(lockfilePath);

      expect(read).toEqual(original);
    });

    it("handles multiple rules", () => {
      const alignWithMultipleRules: Align = {
        ...mockAlign,
        sections: [
          mockAlign.sections[0],
          {
            ...mockAlign.sections[0],
            id: "test.rule.two",
            fingerprint: "test.rule.two",
          },
          {
            ...mockAlign.sections[0],
            id: "test.rule.three",
            fingerprint: "test.rule.three",
          },
        ],
      };
      const original = generateLockfile(alignWithMultipleRules, "team");

      writeLockfile(lockfilePath, original);
      const read = readLockfile(lockfilePath);

      expect(read?.rules).toHaveLength(3);
      expect(read?.rules).toEqual(original.rules);
    });
  });
});
