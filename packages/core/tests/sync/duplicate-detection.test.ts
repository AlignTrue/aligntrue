/**
 * Tests for duplicate export detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { detectDuplicateExports } from "../../src/sync/cleanup.js";

const TEST_DIR = join(
  process.cwd(),
  "packages/core/tests/sync/temp-duplicates",
);

describe("detectDuplicateExports", () => {
  beforeEach(() => {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      try {
        rmSync(TEST_DIR, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("returns empty array when no export directories exist", () => {
    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor", "amazonq"]);

    expect(duplicates).toEqual([]);
  });

  it("returns empty array when no duplicate files exist", () => {
    // Create export directories with unique files
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule1.mdc"),
      "# Rule 1\nContent 1",
    );
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule2.mdc"),
      "# Rule 2\nContent 2",
    );

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor"]);

    expect(duplicates).toEqual([]);
  });

  it("detects duplicate files with identical content", () => {
    // Create export directories with duplicate files
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    const content = "# Guidance\nSame content here";

    writeFileSync(join(TEST_DIR, ".cursor/rules/ai-guidance.mdc"), content);
    writeFileSync(join(TEST_DIR, ".cursor/rules/ai-guidance2.mdc"), content);
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/other.mdc"),
      "# Other\nDifferent content",
    );

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor"]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toEqual({
      directory: ".cursor/rules",
      agent: "cursor",
      files: ["ai-guidance.mdc", "ai-guidance2.mdc"],
    });
  });

  it("handles multiple agents with duplicates", () => {
    // Create cursor exports
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    const content1 = "# Guidance\nContent";
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance.mdc"), content1);
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance-old.mdc"), content1);

    // Create amazonq exports
    mkdirSync(join(TEST_DIR, ".amazonq/rules"), { recursive: true });
    const content2 = "# Style\nContent";
    writeFileSync(join(TEST_DIR, ".amazonq/rules/style.md"), content2);
    writeFileSync(join(TEST_DIR, ".amazonq/rules/style-old.md"), content2);

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor", "amazonq"]);

    expect(duplicates).toHaveLength(2);
    expect(duplicates.map((d) => d.agent)).toEqual(["cursor", "amazonq"]);
    expect(duplicates[0].files.length).toBe(2);
    expect(duplicates[1].files.length).toBe(2);
  });

  it("skips single-file exporters", () => {
    // AGENTS.md is a single-file format, should not be checked
    mkdirSync(join(TEST_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Agent Rules");

    const duplicates = detectDuplicateExports(TEST_DIR, ["agents"]);

    expect(duplicates).toEqual([]);
  });

  it("skips directories that cannot be read", () => {
    // Create a valid directory
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".cursor/rules/rule1.mdc"), "# Rule\nContent");

    // Should not throw, even with invalid agents
    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor", "invalid"]);

    expect(duplicates).toEqual([]);
  });

  it("groups multiple duplicate pairs in same directory", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    // First duplicate pair
    const content1 = "# Guidance\nFirst set";
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance.mdc"), content1);
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance-old.mdc"), content1);

    // Second duplicate pair
    const content2 = "# Style\nSecond set";
    writeFileSync(join(TEST_DIR, ".cursor/rules/style.mdc"), content2);
    writeFileSync(join(TEST_DIR, ".cursor/rules/style-old.mdc"), content2);

    // Unique file
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/unique.mdc"),
      "# Unique\nNo duplicates",
    );

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor"]);

    // Should find 2 duplicate groups for the same directory
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0].directory).toBe(".cursor/rules");
    expect(duplicates[1].directory).toBe(".cursor/rules");
    expect(duplicates[0].files).toHaveLength(2);
    expect(duplicates[1].files).toHaveLength(2);
  });

  it("sorts files within each duplicate group", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    const content = "# Rule\nContent";

    writeFileSync(join(TEST_DIR, ".cursor/rules/z-rule.mdc"), content);
    writeFileSync(join(TEST_DIR, ".cursor/rules/a-rule.mdc"), content);
    writeFileSync(join(TEST_DIR, ".cursor/rules/m-rule.mdc"), content);

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor"]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].files).toEqual([
      "a-rule.mdc",
      "m-rule.mdc",
      "z-rule.mdc",
    ]);
  });

  it("ignores subdirectories when scanning for files", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules/subdir"), { recursive: true });
    const content = "# Rule\nContent";

    writeFileSync(join(TEST_DIR, ".cursor/rules/rule.mdc"), content);
    writeFileSync(join(TEST_DIR, ".cursor/rules/subdir/rule.mdc"), content);

    const duplicates = detectDuplicateExports(TEST_DIR, ["cursor"]);

    // Should only find duplicates at the top level, not in subdirs
    expect(duplicates).toEqual([]);
  });

  it("handles various multi-file exporters", () => {
    // Create directories for different exporters
    mkdirSync(join(TEST_DIR, ".trae/rules"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".kiro/steering"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".cline/rules"), { recursive: true });

    const content = "# Rule\nContent";

    // Trae-AI
    writeFileSync(join(TEST_DIR, ".trae/rules/rule.md"), content);
    writeFileSync(join(TEST_DIR, ".trae/rules/rule-old.md"), content);

    // Kiro
    writeFileSync(join(TEST_DIR, ".kiro/steering/directive.md"), content);
    writeFileSync(join(TEST_DIR, ".kiro/steering/directive-old.md"), content);

    // Cline
    writeFileSync(join(TEST_DIR, ".cline/rules/instruction.md"), content);
    writeFileSync(join(TEST_DIR, ".cline/rules/instruction-old.md"), content);

    const duplicates = detectDuplicateExports(TEST_DIR, [
      "trae-ai",
      "kiro",
      "cline",
    ]);

    expect(duplicates).toHaveLength(3);
    expect(duplicates.map((d) => d.agent).sort()).toEqual([
      "cline",
      "kiro",
      "trae-ai",
    ]);
  });

  it("returns empty array for non-existent output directory", () => {
    const nonExistentDir = join(TEST_DIR, "does-not-exist");

    const duplicates = detectDuplicateExports(nonExistentDir, ["cursor"]);

    expect(duplicates).toEqual([]);
  });
});
