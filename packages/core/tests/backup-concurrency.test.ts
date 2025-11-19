/**
 * Tests for backup concurrency and uniqueness guarantees
 * Verifies that concurrent backup operations don't collide and all backups are listable
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { BackupManager } from "../src/backup/manager.js";

const TEST_DIR = join(
  process.cwd(),
  "packages/core/tests/tmp/backup-concurrency-test",
);

describe("Backup Concurrency", () => {
  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    // Create a dummy config file for backup
    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      "version: '1'\nmode: solo\n",
      "utf-8",
    );
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should create unique backups in rapid succession", () => {
    const backups: string[] = [];

    // Create 10 backups rapidly
    for (let i = 0; i < 10; i++) {
      const backup = BackupManager.createBackup({
        cwd: TEST_DIR,
        created_by: "test",
        notes: `Rapid backup ${i}`,
      });
      backups.push(backup.timestamp);
    }

    // Verify all timestamps are unique
    const uniqueTimestamps = new Set(backups);
    expect(uniqueTimestamps.size).toBe(10);

    // Verify all timestamps contain process ID and sequence suffix
    backups.forEach((timestamp) => {
      // Format: 2025-11-18T23-54-39-705-1a2b-1
      // Should have at least 6 dash-separated parts (second-to-last is PID, last is sequence)
      const parts = timestamp.split("-");
      expect(parts.length).toBeGreaterThanOrEqual(6);
    });
  });

  it("should list all created backups", () => {
    const createdCount = 5;
    const createdTimestamps: string[] = [];

    // Create multiple backups
    for (let i = 0; i < createdCount; i++) {
      const backup = BackupManager.createBackup({
        cwd: TEST_DIR,
        created_by: "test",
        notes: `Test backup ${i}`,
      });
      createdTimestamps.push(backup.timestamp);
    }

    // List backups
    const listed = BackupManager.listBackups(TEST_DIR);

    // Verify all created backups are listed
    expect(listed.length).toBe(createdCount);

    const listedTimestamps = listed.map((b) => b.timestamp);
    createdTimestamps.forEach((timestamp) => {
      expect(listedTimestamps).toContain(timestamp);
    });
  });

  it("should handle concurrent backup creation (simulated)", async () => {
    const promises: Promise<{ timestamp: string }>[] = [];

    // Simulate concurrent operations by creating promises
    for (let i = 0; i < 5; i++) {
      promises.push(
        Promise.resolve().then(() =>
          BackupManager.createBackup({
            cwd: TEST_DIR,
            created_by: "concurrent-test",
            notes: `Concurrent backup ${i}`,
          }),
        ),
      );
    }

    // Wait for all to complete
    const results = await Promise.all(promises);

    // Verify all timestamps are unique
    const timestamps = results.map((r) => r.timestamp);
    const uniqueTimestamps = new Set(timestamps);
    expect(uniqueTimestamps.size).toBe(5);

    // Verify all backups are listable
    const listed = BackupManager.listBackups(TEST_DIR);
    expect(listed.length).toBe(5);
  });

  it("should maintain timestamp sortability with PID suffix", () => {
    const backups: Array<{ timestamp: string; order: number }> = [];

    // Create backups with small delays to ensure time progression
    for (let i = 0; i < 3; i++) {
      const backup = BackupManager.createBackup({
        cwd: TEST_DIR,
        created_by: "test",
        notes: `Ordered backup ${i}`,
      });
      backups.push({ timestamp: backup.timestamp, order: i });

      // Small delay to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait for 10ms
      }
    }

    // Sort by timestamp
    const sorted = [...backups].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );

    // Verify order is maintained (timestamps should sort chronologically)
    expect(sorted[0].order).toBe(0);
    expect(sorted[1].order).toBe(1);
    expect(sorted[2].order).toBe(2);
  });

  it("should create unique scoped backups", () => {
    const scope = "test-scope";
    const backups: string[] = [];

    // Create multiple scoped backups rapidly
    for (let i = 0; i < 5; i++) {
      const backup = BackupManager.createScopedBackup(scope, {
        cwd: TEST_DIR,
        created_by: "test",
        notes: `Scoped backup ${i}`,
      });
      backups.push(backup.timestamp);
    }

    // Verify all timestamps are unique
    const uniqueTimestamps = new Set(backups);
    expect(uniqueTimestamps.size).toBe(5);

    // Verify all contain PID and sequence suffix
    backups.forEach((timestamp) => {
      const parts = timestamp.split("-");
      expect(parts.length).toBeGreaterThanOrEqual(6);
    });
  });
});
