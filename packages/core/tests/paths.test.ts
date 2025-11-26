/**
 * Tests for path utilities
 */

import { describe, it, expect } from "vitest";
import { join, sep } from "path";
import {
  getAlignTruePaths,
  getAlignTrueDir,
  getCacheDir,
} from "../src/paths.js";

describe("getAlignTruePaths", () => {
  const testCwd = "/test/workspace";

  it("should generate standard config path", () => {
    const paths = getAlignTruePaths(testCwd);
    expect(paths.config).toBe(join(testCwd, ".aligntrue", "config.yaml"));
  });

  it("should generate Cursor rules path for custom scope", () => {
    const paths = getAlignTruePaths(testCwd);
    expect(paths.cursorRules("backend")).toBe(
      join(testCwd, ".cursor", "rules", "backend.mdc"),
    );
  });

  it("should generate exporter output paths for cursor", () => {
    const paths = getAlignTruePaths(testCwd);
    expect(paths.exporterOutput("cursor", "test.mdc")).toBe(
      join(testCwd, ".cursor", "rules", "test.mdc"),
    );
  });

  it("should use current working directory by default", () => {
    const paths = getAlignTruePaths();
    expect(paths.config).toBe(join(process.cwd(), ".aligntrue", "config.yaml"));
  });

  it("should use platform-specific path separators", () => {
    const paths = getAlignTruePaths(testCwd);
    // Test that path contains platform separator
    expect(paths.config).toContain(sep);
  });
});

describe("getAlignTrueDir", () => {
  it("should return .aligntrue directory path", () => {
    const dir = getAlignTrueDir("/test/workspace");
    expect(dir).toBe(join("/test/workspace", ".aligntrue"));
  });
});

describe("getCacheDir", () => {
  it("should return cache directory for git", () => {
    const dir = getCacheDir("git", "/test/workspace");
    expect(dir).toBe(join("/test/workspace", ".aligntrue", ".cache", "git"));
  });
});
