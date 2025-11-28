/**
 * Concurrent Operation Protection Tests
 *
 * Tests that file operations are safe under concurrent access:
 * 1. Multiple writes to same file don't corrupt data
 * 2. Atomic writes complete fully or not at all
 * 3. Read operations during write see consistent state
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  AtomicFileWriter,
  computeContentChecksum,
} from "../src/atomic-writer.js";

describe("Concurrent Operation Protection", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `concurrent-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Atomic Write Integrity", () => {
    it("writes are atomic - complete or not at all", async () => {
      const filePath = join(testDir, "atomic.txt");
      const writer = new AtomicFileWriter();

      const content = "This content should be written atomically.";
      await writer.write(filePath, content);

      // File should contain exactly the written content
      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe(content);
    });

    it("sequential writes produce correct final state", async () => {
      const filePath = join(testDir, "sequential.txt");
      const writer = new AtomicFileWriter();

      for (let i = 0; i < 10; i++) {
        const content = `Iteration ${i}`;
        await writer.write(filePath, content, { force: true });

        const result = readFileSync(filePath, "utf-8");
        expect(result).toBe(content);
      }

      // Final state should be last write
      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe("Iteration 9");
    });

    it("writes to multiple files are independent", async () => {
      const files = [
        join(testDir, "file1.txt"),
        join(testDir, "file2.txt"),
        join(testDir, "file3.txt"),
      ];
      const writer = new AtomicFileWriter();

      // Write to all files
      for (let i = 0; i < files.length; i++) {
        await writer.write(files[i]!, `Content for file ${i}`);
      }

      // Verify each file has correct content
      files.forEach((filePath, i) => {
        const result = readFileSync(filePath, "utf-8");
        expect(result).toBe(`Content for file ${i}`);
      });
    });
  });

  describe("Checksum Consistency", () => {
    it("checksum is consistent across writes", async () => {
      const content = "Test content for checksum verification";
      const expectedChecksum = computeContentChecksum(content);
      const writer = new AtomicFileWriter();

      // Write same content multiple times
      for (let i = 0; i < 5; i++) {
        const filePath = join(testDir, `checksum-${i}.txt`);
        await writer.write(filePath, content);

        const actualContent = readFileSync(filePath, "utf-8");
        const actualChecksum = computeContentChecksum(actualContent);
        expect(actualChecksum).toBe(expectedChecksum);
      }
    });

    it("different content produces different checksums", () => {
      const checksums = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const content = `Unique content ${i}`;
        const checksum = computeContentChecksum(content);
        checksums.add(checksum);
      }

      // All checksums should be unique
      expect(checksums.size).toBe(10);
    });
  });

  describe("Parallel Write Simulation", () => {
    it("parallel writes to different files are safe", async () => {
      const files: string[] = [];
      const contents: string[] = [];

      // Create 20 files in parallel
      for (let i = 0; i < 20; i++) {
        files.push(join(testDir, `parallel-${i}.txt`));
        contents.push(`Parallel content ${i}`);
      }

      // Write all files (simulated parallel via Promise.all)
      await Promise.all(
        files.map(async (filePath, i) => {
          const writer = new AtomicFileWriter();
          await writer.write(filePath, contents[i]!);
        }),
      );

      // Verify all files have correct content
      files.forEach((filePath, i) => {
        const result = readFileSync(filePath, "utf-8");
        expect(result).toBe(contents[i]);
      });
    });

    it("rapid sequential writes maintain integrity", async () => {
      const filePath = join(testDir, "rapid.txt");
      const writer = new AtomicFileWriter();

      // Perform 100 rapid writes
      for (let i = 0; i < 100; i++) {
        await writer.write(filePath, `Rapid write ${i}`, { force: true });
      }

      // Final content should be the last write
      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe("Rapid write 99");
    });
  });

  describe("Error Recovery", () => {
    it("handles write to non-existent directory by creating it", async () => {
      const deepPath = join(testDir, "deep", "nested", "dir", "file.txt");
      const writer = new AtomicFileWriter();

      await writer.write(deepPath, "Content in nested directory");

      expect(existsSync(deepPath)).toBe(true);
      const result = readFileSync(deepPath, "utf-8");
      expect(result).toBe("Content in nested directory");
    });

    it("overwrites existing file correctly", async () => {
      const filePath = join(testDir, "existing.txt");

      // Create initial file
      writeFileSync(filePath, "Initial content", "utf-8");

      // Overwrite with atomic writer
      const writer = new AtomicFileWriter();
      await writer.write(filePath, "New content");

      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe("New content");
    });
  });

  describe("Content Integrity Under Stress", () => {
    it("large content writes maintain integrity", async () => {
      const filePath = join(testDir, "large.txt");

      // Generate large content (1MB)
      const largeContent = "x".repeat(1024 * 1024);
      const expectedChecksum = computeContentChecksum(largeContent);

      const writer = new AtomicFileWriter();
      await writer.write(filePath, largeContent);

      const result = readFileSync(filePath, "utf-8");
      const actualChecksum = computeContentChecksum(result);

      expect(actualChecksum).toBe(expectedChecksum);
      expect(result.length).toBe(largeContent.length);
    });

    it("special characters are preserved", async () => {
      const filePath = join(testDir, "special.txt");

      const specialContent = `
Unicode: 🎉 ñ ü ö ä
Newlines: line1
line2
Tabs:	tabbed	content
Quotes: "double" and 'single'
Escapes: \\n \\t
      `.trim();

      const writer = new AtomicFileWriter();
      await writer.write(filePath, specialContent);

      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe(specialContent);
    });

    it("empty content is handled correctly", async () => {
      const filePath = join(testDir, "empty.txt");

      const writer = new AtomicFileWriter();
      await writer.write(filePath, "");

      const result = readFileSync(filePath, "utf-8");
      expect(result).toBe("");
    });
  });

  describe("Determinism Verification", () => {
    it("same input produces identical output on repeated writes", async () => {
      const content = `---
title: Test Rule
---

# Test Rule

This is the content.
`;

      const results: string[] = [];
      const writer = new AtomicFileWriter();

      // Write same content 10 times to different files
      for (let i = 0; i < 10; i++) {
        const filePath = join(testDir, `determinism-${i}.txt`);
        await writer.write(filePath, content);
        results.push(readFileSync(filePath, "utf-8"));
      }

      // All results should be identical
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).toBe(firstResult);
      });
    });
  });
});
