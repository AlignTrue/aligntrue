/**
 * Tests for LocalStorageBackend
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { LocalStorageBackend } from "../../src/storage/local.js";
import type { AlignSection } from "@aligntrue/schema";

describe("LocalStorageBackend", () => {
  const testDir = join(process.cwd(), "temp-test-storage-local");
  const scope = "personal";

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should read empty rules when file doesn't exist", async () => {
    const backend = new LocalStorageBackend(testDir, scope);
    const rules = await backend.read();
    expect(rules).toEqual([]);
  });

  it("should write and read rules", async () => {
    const backend = new LocalStorageBackend(testDir, scope);
    const testRules: AlignSection[] = [
      {
        heading: "Test Rule",
        content: "This is a test rule",
        level: 2,
      },
      {
        heading: "Another Rule",
        content: "This is another test rule",
        level: 2,
      },
    ];

    await backend.write(testRules);

    const readRules = await backend.read();
    expect(readRules).toHaveLength(2);
    expect(readRules[0]?.heading).toBe("Test Rule");
    expect(readRules[1]?.heading).toBe("Another Rule");
  });

  it("should create directory if it doesn't exist", async () => {
    const backend = new LocalStorageBackend(testDir, scope);
    const storagePath = join(testDir, ".aligntrue", ".local", scope);

    expect(existsSync(storagePath)).toBe(false);

    await backend.write([
      {
        heading: "Test",
        content: "Test content",
        level: 2,
      },
    ]);

    expect(existsSync(storagePath)).toBe(true);
  });

  it("should handle sync (no-op for local storage)", async () => {
    const backend = new LocalStorageBackend(testDir, scope);
    await expect(backend.sync()).resolves.not.toThrow();
  });

  it("should overwrite existing rules", async () => {
    const backend = new LocalStorageBackend(testDir, scope);

    await backend.write([
      {
        heading: "Original",
        content: "Original content",
        level: 2,
      },
    ]);

    await backend.write([
      {
        heading: "Updated",
        content: "Updated content",
        level: 2,
      },
    ]);

    const rules = await backend.read();
    expect(rules).toHaveLength(1);
    expect(rules[0]?.heading).toBe("Updated");
  });

  it("should handle empty rules write", async () => {
    const backend = new LocalStorageBackend(testDir, scope);

    await backend.write([]);

    const rules = await backend.read();
    expect(rules).toEqual([]);
  });

  it("should handle malformed markdown gracefully", async () => {
    const backend = new LocalStorageBackend(testDir, scope);
    const storagePath = join(testDir, ".aligntrue", ".local", scope);
    mkdirSync(storagePath, { recursive: true });

    // Write malformed markdown
    writeFileSync(
      join(storagePath, "rules.md"),
      "Not valid markdown\n\n",
      "utf-8",
    );

    const rules = await backend.read();
    // Should return empty array or parsed sections, not throw
    expect(Array.isArray(rules)).toBe(true);
  });
});
