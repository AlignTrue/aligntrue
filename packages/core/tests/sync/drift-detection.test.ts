/**
 * Drift Detection Tests
 *
 * Tests the drift log persistence and new file detection features
 * used by watch mode to track pending imports across sessions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, existsSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadDriftLog,
  addDriftDetection,
  updateDriftStatus,
  getPendingDetections,
  clearDetectionsByStatus,
  clearAllDetections,
} from "../../src/sync/drift-detection.js";

describe("Drift Detection", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `drift-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(join(testDir, ".aligntrue"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Drift Log Persistence", () => {
    it("creates drift log when adding detection", () => {
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");

      const logPath = join(testDir, ".aligntrue", ".drift-log.json");
      expect(existsSync(logPath)).toBe(true);
    });

    it("persists detections across sessions (load/save)", () => {
      // First "session" - add detection
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");

      // Simulate new session by loading fresh
      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(1);
      expect(log.detections[0]!.file).toBe("AGENTS.md");
      expect(log.detections[0]!.sections).toBe(5);
      expect(log.detections[0]!.status).toBe("pending_review");
    });

    it("updates existing detection instead of duplicating", () => {
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");
      addDriftDetection(testDir, "AGENTS.md", 7, "pending_review"); // More sections

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(1); // Still 1 entry
      expect(log.detections[0]!.sections).toBe(7); // Updated count
    });

    it("tracks multiple files independently", () => {
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");
      addDriftDetection(testDir, ".cursor/rules/new.mdc", 3, "pending_review");
      addDriftDetection(testDir, "docs/guide.md", 10, "pending_review");

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(3);
    });

    it("handles corrupted drift log gracefully", () => {
      const logPath = join(testDir, ".aligntrue", ".drift-log.json");
      writeFileSync(logPath, "{ invalid json", "utf-8");

      const log = loadDriftLog(testDir);
      expect(log.detections).toEqual([]);
    });

    it("handles missing drift log", () => {
      const log = loadDriftLog(testDir);
      expect(log.detections).toEqual([]);
    });
  });

  describe("Status Management", () => {
    it("updates detection status", () => {
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");
      updateDriftStatus(testDir, "AGENTS.md", "imported");

      const log = loadDriftLog(testDir);
      expect(log.detections[0]!.status).toBe("imported");
    });

    it("gets only pending detections", () => {
      addDriftDetection(testDir, "file1.md", 5, "pending_review");
      addDriftDetection(testDir, "file2.md", 3, "imported");
      addDriftDetection(testDir, "file3.md", 2, "ignored");
      addDriftDetection(testDir, "file4.md", 4, "pending_review");

      const pending = getPendingDetections(testDir);
      expect(pending.length).toBe(2);
      expect(pending.map((d) => d.file)).toContain("file1.md");
      expect(pending.map((d) => d.file)).toContain("file4.md");
    });

    it("clears detections by status", () => {
      addDriftDetection(testDir, "file1.md", 5, "pending_review");
      addDriftDetection(testDir, "file2.md", 3, "imported");
      addDriftDetection(testDir, "file3.md", 2, "imported");

      clearDetectionsByStatus(testDir, "imported");

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(1);
      expect(log.detections[0]!.file).toBe("file1.md");
    });

    it("clears all detections", () => {
      addDriftDetection(testDir, "file1.md", 5, "pending_review");
      addDriftDetection(testDir, "file2.md", 3, "imported");

      clearAllDetections(testDir);

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(0);
    });
  });

  describe("Timestamps", () => {
    it("records timestamp when adding detection", () => {
      const before = new Date().toISOString();
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");
      const after = new Date().toISOString();

      const log = loadDriftLog(testDir);
      const timestamp = log.detections[0]!.timestamp;

      expect(timestamp >= before).toBe(true);
      expect(timestamp <= after).toBe(true);
    });

    it("updates timestamp when status changes", async () => {
      addDriftDetection(testDir, "AGENTS.md", 5, "pending_review");
      const log1 = loadDriftLog(testDir);
      const originalTimestamp = log1.detections[0]!.timestamp;

      // Wait a bit to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      updateDriftStatus(testDir, "AGENTS.md", "imported");
      const log2 = loadDriftLog(testDir);
      const updatedTimestamp = log2.detections[0]!.timestamp;

      expect(updatedTimestamp > originalTimestamp).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("handles empty file path", () => {
      addDriftDetection(testDir, "", 5, "pending_review");

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(1);
      expect(log.detections[0]!.file).toBe("");
    });

    it("handles zero sections", () => {
      addDriftDetection(testDir, "empty.md", 0, "pending_review");

      const log = loadDriftLog(testDir);
      expect(log.detections[0]!.sections).toBe(0);
    });

    it("handles special characters in file paths", () => {
      const specialPath = "path with spaces/file[1].md";
      addDriftDetection(testDir, specialPath, 5, "pending_review");

      const log = loadDriftLog(testDir);
      expect(log.detections[0]!.file).toBe(specialPath);
    });

    it("no-op when updating non-existent file", () => {
      addDriftDetection(testDir, "exists.md", 5, "pending_review");
      updateDriftStatus(testDir, "does-not-exist.md", "imported");

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(1);
      expect(log.detections[0]!.status).toBe("pending_review");
    });
  });

  describe("Concurrent Access Simulation", () => {
    it("handles rapid sequential writes", () => {
      for (let i = 0; i < 10; i++) {
        addDriftDetection(testDir, `file${i}.md`, i, "pending_review");
      }

      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(10);
    });

    it("maintains log integrity after many operations", () => {
      // Add
      addDriftDetection(testDir, "file1.md", 5, "pending_review");
      addDriftDetection(testDir, "file2.md", 3, "pending_review");

      // Update
      updateDriftStatus(testDir, "file1.md", "imported");

      // Add more
      addDriftDetection(testDir, "file3.md", 7, "pending_review");

      // Clear some
      clearDetectionsByStatus(testDir, "imported");

      // Final state
      const log = loadDriftLog(testDir);
      expect(log.detections.length).toBe(2);
      expect(log.detections.map((d) => d.file).sort()).toEqual([
        "file2.md",
        "file3.md",
      ]);
    });
  });
});
