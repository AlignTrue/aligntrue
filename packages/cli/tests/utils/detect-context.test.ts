/**
 * Tests for detectContext utility
 */

import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { detectContext } from "../../src/utils/detect-context.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "detect-context-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("detectContext", () => {
  it("treats standalone lockfile as already-initialized", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".aligntrue.lock.json"), "{}");

    const result = detectContext(dir);

    expect(result.context).toBe("already-initialized");
    expect(result.existingFiles).toContain(".aligntrue.lock.json");
  });

  it("treats standalone bundle as already-initialized", () => {
    const dir = createTempDir();
    writeFileSync(join(dir, ".aligntrue.bundle.yaml"), "version: 1");

    const result = detectContext(dir);

    expect(result.context).toBe("already-initialized");
    expect(result.existingFiles).toContain(".aligntrue.bundle.yaml");
  });
});
