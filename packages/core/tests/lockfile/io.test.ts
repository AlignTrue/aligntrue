import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readLockfile, writeLockfile } from "../../src/lockfile/io.js";
import type { Lockfile } from "../../src/lockfile/types.js";
import { existsSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

describe("lockfile I/O", () => {
  const testDir = join(process.cwd(), "packages/core/tests/lockfile/temp");
  const lockfilePath = join(testDir, ".aligntrue/lock.json");

  const mockLockfile: Lockfile = {
    version: "2",
    bundle_hash: "sha256:abc123def456",
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
      writeLockfile(lockfilePath, mockLockfile);

      expect(existsSync(lockfilePath)).toBe(true);
    });

    it("creates parent directory if missing", () => {
      const nestedPath = join(testDir, "nested/dir/.aligntrue/lock.json");

      writeLockfile(nestedPath, mockLockfile);

      expect(existsSync(nestedPath)).toBe(true);
    });

    it("formats JSON with 2-space indent", () => {
      writeLockfile(lockfilePath, mockLockfile);

      const content = readFileSync(lockfilePath, "utf8");
      const lines = content.split("\n");

      // Check indentation
      expect(lines.some((line) => line.startsWith('  "bundle_hash"'))).toBe(
        true,
      );
    });

    it("adds trailing newline", () => {
      writeLockfile(lockfilePath, mockLockfile);

      const content = readFileSync(lockfilePath, "utf8");
      expect(content.endsWith("\n")).toBe(true);
    });

    it("sorts JSON keys", () => {
      writeLockfile(lockfilePath, mockLockfile);

      const content = readFileSync(lockfilePath, "utf8");
      const lines = content.split("\n");

      // Find positions of keys
      const bundleHashLine = lines.findIndex((l) =>
        l.includes('"bundle_hash"'),
      );
      const versionLine = lines.findIndex((l) => l.includes('"version"'));

      // Keys should be alphabetically sorted (bundle_hash before version)
      expect(bundleHashLine).toBeLessThan(versionLine);
    });

    it("overwrites existing file", () => {
      const lockfile1: Lockfile = { version: "2", bundle_hash: "sha256:first" };
      const lockfile2: Lockfile = {
        version: "2",
        bundle_hash: "sha256:second",
      };

      writeLockfile(lockfilePath, lockfile1);
      writeLockfile(lockfilePath, lockfile2);

      const read = readLockfile(lockfilePath);
      expect(read?.bundle_hash).toBe("sha256:second");
    });

    it("uses atomic write (temp+rename)", () => {
      writeLockfile(lockfilePath, mockLockfile);

      // After successful write, temp file should not exist
      const tempPath = `${lockfilePath}.tmp`;
      expect(existsSync(tempPath)).toBe(false);
    });

    it("throws on write errors", () => {
      // Use a path that will definitely fail on all platforms
      const invalidPath =
        process.platform === "win32"
          ? "Z:\\nonexistent\\path\\.aligntrue/lock.json"
          : "/root/nonexistent/.aligntrue/lock.json";

      expect(() => {
        writeLockfile(invalidPath, mockLockfile);
      }).toThrow();
    });
  });

  describe("readLockfile", () => {
    it("reads lockfile from disk", () => {
      writeLockfile(lockfilePath, mockLockfile);

      const read = readLockfile(lockfilePath);

      expect(read).not.toBeNull();
      expect(read?.version).toBe("2");
      expect(read?.bundle_hash).toBe(mockLockfile.bundle_hash);
    });

    it("returns null for missing file", () => {
      const read = readLockfile(join(testDir, "nonexistent.lock.json"));

      expect(read).toBeNull();
    });

    it("throws on invalid JSON", () => {
      const invalidJsonPath = join(testDir, "invalid.lock.json");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(invalidJsonPath, "{ invalid json }", "utf8");

      expect(() => {
        readLockfile(invalidJsonPath);
      }).toThrow(/Failed to read lockfile/);
    });

    it("throws on invalid structure", () => {
      const invalidStructurePath = join(testDir, "invalid-structure.lock.json");
      mkdirSync(testDir, { recursive: true });
      writeFileSync(
        invalidStructurePath,
        JSON.stringify({ foo: "bar" }),
        "utf8",
      );

      expect(() => {
        readLockfile(invalidStructurePath);
      }).toThrow(/Invalid lockfile structure/);
    });

    it("reads v1 lockfile and returns simplified format", () => {
      // Write a v1 format lockfile
      const v1Lockfile = {
        version: "1",
        generated_at: "2024-01-01T00:00:00.000Z",
        mode: "team",
        rules: [{ rule_id: "test", content_hash: "sha256:abc" }],
        bundle_hash: "sha256:v1bundlehash",
      };
      mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
      writeFileSync(lockfilePath, JSON.stringify(v1Lockfile), "utf8");

      const read = readLockfile(lockfilePath);

      // Should extract just the essential fields
      expect(read).not.toBeNull();
      expect(read?.version).toBe("1");
      expect(read?.bundle_hash).toBe("sha256:v1bundlehash");
    });

    it("preserves all lockfile fields", () => {
      writeLockfile(lockfilePath, mockLockfile);

      const read = readLockfile(lockfilePath);

      expect(read?.version).toBe(mockLockfile.version);
      expect(read?.bundle_hash).toBe(mockLockfile.bundle_hash);
    });
  });

  describe("round-trip", () => {
    it("maintains data integrity", () => {
      writeLockfile(lockfilePath, mockLockfile);
      const read = readLockfile(lockfilePath);

      expect(read).toEqual(mockLockfile);
    });
  });
});
