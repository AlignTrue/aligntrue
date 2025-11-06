/**
 * Tests for edit detection and conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EditDetector } from "../../src/sync/edit-detector.js";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("EditDetector", () => {
  let tempDir: string;
  let detector: EditDetector;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "aligntrue-edit-test-"));
    detector = new EditDetector(tempDir);
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should detect file modification time", () => {
    const testFile = join(tempDir, "test.md");
    const beforeWrite = Date.now();
    writeFileSync(testFile, "initial content");
    const afterWrite = Date.now();

    const mtime = detector.getFileModificationTime(testFile);
    expect(mtime).toBeGreaterThan(0);
    // mtime should be between beforeWrite and afterWrite + small buffer for filesystem precision
    expect(mtime).toBeGreaterThanOrEqual(beforeWrite - 10);
    expect(mtime).toBeLessThanOrEqual(afterWrite + 10);
  });

  it("should return null for non-existent files", () => {
    const mtime = detector.getFileModificationTime(
      join(tempDir, "nonexistent.md"),
    );
    expect(mtime).toBeNull();
  });

  it("should detect if file was modified since timestamp", () => {
    const testFile = join(tempDir, "test.md");

    const beforeWrite = Date.now();
    writeFileSync(testFile, "content");
    const afterWrite = Date.now();

    // File should be modified after beforeWrite
    expect(detector.wasFileModifiedSince(testFile, beforeWrite - 1000)).toBe(
      true,
    );

    // File should not be modified after afterWrite
    expect(detector.wasFileModifiedSince(testFile, afterWrite + 1000)).toBe(
      false,
    );
  });

  it("should detect conflicts when both files modified", async () => {
    const irPath = join(tempDir, ".aligntrue", ".rules.yaml");
    const agentPath = join(tempDir, ".cursor", "rules", "aligntrue.mdc");

    // Create .aligntrue directory
    const aligntrueDir = join(tempDir, ".aligntrue");
    const cursorDir = join(tempDir, ".cursor", "rules");
    rmSync(aligntrueDir, { recursive: true, force: true });
    rmSync(cursorDir, { recursive: true, force: true });

    // Write initial files
    mkdirSync(aligntrueDir, { recursive: true });
    mkdirSync(cursorDir, { recursive: true });

    writeFileSync(irPath, "IR content v1");
    writeFileSync(agentPath, "Agent content v1");

    // Update last sync timestamp
    detector.updateLastSyncTimestamp();

    // Wait a bit to ensure different mtimes
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Modify both files
    writeFileSync(irPath, "IR content v2");
    writeFileSync(agentPath, "Agent content v2");

    const conflictInfo = detector.hasConflict(irPath, agentPath);
    expect(conflictInfo.hasConflict).toBe(true);
    expect(conflictInfo.reason).toContain("Both");
  });

  it("should not detect conflict when only IR modified", async () => {
    const irPath = join(tempDir, ".aligntrue", ".rules.yaml");
    const agentPath = join(tempDir, ".cursor", "rules", "aligntrue.mdc");

    // Create directories
    mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });
    mkdirSync(join(tempDir, ".cursor", "rules"), { recursive: true });

    // Write initial files
    writeFileSync(irPath, "IR content v1");
    writeFileSync(agentPath, "Agent content v1");

    // Wait to ensure initial files have stable mtime
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update last sync timestamp AFTER initial files are written
    detector.updateLastSyncTimestamp();

    // Wait for filesystem mtime resolution (macOS APFS can be slow)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify only IR
    writeFileSync(irPath, "IR content v2");

    const conflictInfo = detector.hasConflict(irPath, agentPath);
    expect(conflictInfo.hasConflict).toBe(false);
  });

  it("should not detect conflict when only agent modified", async () => {
    const irPath = join(tempDir, ".aligntrue", ".rules.yaml");
    const agentPath = join(tempDir, ".cursor", "rules", "aligntrue.mdc");

    // Create directories
    mkdirSync(join(tempDir, ".aligntrue"), { recursive: true });
    mkdirSync(join(tempDir, ".cursor", "rules"), { recursive: true });

    // Write initial files
    writeFileSync(irPath, "IR content v1");
    writeFileSync(agentPath, "Agent content v1");

    // Wait to ensure initial files have stable mtime
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update last sync timestamp AFTER initial files are written
    detector.updateLastSyncTimestamp();

    // Wait for filesystem mtime resolution (macOS APFS can be slow)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify only agent
    writeFileSync(agentPath, "Agent content v2");

    const conflictInfo = detector.hasConflict(irPath, agentPath);
    expect(conflictInfo.hasConflict).toBe(false);
  });

  it("should handle missing last sync timestamp gracefully", () => {
    const irPath = join(tempDir, "rules.md");
    const agentPath = join(tempDir, "agent.mdc");

    writeFileSync(irPath, "IR content");
    writeFileSync(agentPath, "Agent content");

    // Don't set last sync timestamp
    const conflictInfo = detector.hasConflict(irPath, agentPath);

    // Should not detect conflict without timestamp
    expect(conflictInfo.hasConflict).toBe(false);
    expect(conflictInfo.reason).toContain("No previous sync");
  });

  it("should persist and retrieve last sync timestamp", () => {
    const timestamp1 = detector.getLastSyncTimestamp();
    expect(timestamp1).toBeNull();

    detector.updateLastSyncTimestamp();

    const timestamp2 = detector.getLastSyncTimestamp();
    expect(timestamp2).toBeGreaterThan(0);
    expect(timestamp2).toBeLessThanOrEqual(Date.now());
  });

  it("should provide edit info for files", async () => {
    const testFile = join(tempDir, "test.md");
    writeFileSync(testFile, "content");

    detector.updateLastSyncTimestamp();

    // Wait for filesystem mtime resolution (macOS APFS can be slow)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Modify file
    writeFileSync(testFile, "modified content");

    const editInfo = detector.getEditInfo(testFile);
    expect(editInfo.filePath).toBe(testFile);
    expect(editInfo.wasModifiedSince).toBe(true);
    expect(editInfo.lastModified).toBeGreaterThan(0);
  });
});
