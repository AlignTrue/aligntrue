/**
 * Tests for stale export detection and cleanup
 * (Replaces old duplicate detection tests with new stale export detection)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import {
  detectStaleExports,
  cleanStaleExports,
  type SourceRuleInfo,
} from "../../src/sync/cleanup.js";

const TEST_DIR = join(
  process.cwd(),
  "packages/core/tests/sync/temp-duplicates",
);

describe("detectStaleExports", () => {
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
    const sourceRules: SourceRuleInfo[] = [{ name: "rule1" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, [
      "cursor",
      "amazonq",
    ]);

    expect(stale).toEqual([]);
  });

  it("returns empty array when all files match source rules", () => {
    // Create export directories with files matching sources
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule1.mdc"),
      "# Rule 1\nContent 1",
    );
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule2.mdc"),
      "# Rule 2\nContent 2",
    );

    const sourceRules: SourceRuleInfo[] = [
      { name: "rule1" },
      { name: "rule2" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    expect(stale).toEqual([]);
  });

  it("detects stale files with no matching source", () => {
    // Create export directories
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule1.mdc"),
      "# Rule 1\nContent",
    );
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/rule2.mdc"),
      "# Rule 2\nContent",
    );
    writeFileSync(
      join(TEST_DIR, ".cursor/rules/old-rule.mdc"),
      "# Old\nContent",
    );

    const sourceRules: SourceRuleInfo[] = [
      { name: "rule1" },
      { name: "rule2" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    expect(stale).toHaveLength(1);
    expect(stale[0]).toEqual({
      directory: ".cursor/rules",
      agent: "cursor",
      files: ["old-rule.mdc"],
    });
  });

  it("handles multiple agents with stale files", () => {
    // Create cursor exports
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/guidance-old.mdc"), "Content");

    // Create amazonq exports
    mkdirSync(join(TEST_DIR, ".amazonq/rules"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".amazonq/rules/style.md"), "Content");
    writeFileSync(join(TEST_DIR, ".amazonq/rules/style-old.md"), "Content");

    const sourceRules: SourceRuleInfo[] = [
      { name: "guidance" },
      { name: "style" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, [
      "cursor",
      "amazonq",
    ]);

    expect(stale).toHaveLength(2);
    expect(stale.map((s) => s.agent).sort()).toEqual(["amazonq", "cursor"]);
  });

  it("skips single-file exporters", () => {
    // AGENTS.md is a single-file format, should not be checked
    mkdirSync(join(TEST_DIR), { recursive: true });
    writeFileSync(join(TEST_DIR, "AGENTS.md"), "# Agent Rules");

    const sourceRules: SourceRuleInfo[] = [{ name: "rule1" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["agents"]);

    expect(stale).toEqual([]);
  });

  it("skips directories that cannot be read", () => {
    // Create a valid directory
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    writeFileSync(join(TEST_DIR, ".cursor/rules/rule1.mdc"), "# Rule\nContent");

    // Should not throw, even with invalid agents
    const sourceRules: SourceRuleInfo[] = [{ name: "rule1" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, [
      "cursor",
      "invalid",
    ]);

    expect(stale).toEqual([]);
  });

  it("sorts stale files alphabetically", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/z-old.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/a-old.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/m-old.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/rule.mdc"), "Content");

    const sourceRules: SourceRuleInfo[] = [{ name: "rule" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    expect(stale).toHaveLength(1);
    expect(stale[0].files).toEqual(["a-old.mdc", "m-old.mdc", "z-old.mdc"]);
  });

  it("ignores subdirectories when scanning for files", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules/subdir"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/rule.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/subdir/rule.mdc"), "Content");

    const sourceRules: SourceRuleInfo[] = [{ name: "rule" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    // Should only find top-level files, not in subdirs
    expect(stale).toEqual([]);
  });

  it("handles various multi-file exporters", () => {
    // Create directories for different exporters
    mkdirSync(join(TEST_DIR, ".trae/rules"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".kiro/steering"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".cline/rules"), { recursive: true });

    // Trae-AI - one stale
    writeFileSync(join(TEST_DIR, ".trae/rules/rule.md"), "Content");
    writeFileSync(join(TEST_DIR, ".trae/rules/old.md"), "Content");

    // Kiro - one stale
    writeFileSync(join(TEST_DIR, ".kiro/steering/directive.md"), "Content");
    writeFileSync(join(TEST_DIR, ".kiro/steering/old.md"), "Content");

    // Cline - one stale
    writeFileSync(join(TEST_DIR, ".cline/rules/instruction.md"), "Content");
    writeFileSync(join(TEST_DIR, ".cline/rules/old.md"), "Content");

    const sourceRules: SourceRuleInfo[] = [
      { name: "rule" },
      { name: "directive" },
      { name: "instruction" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, [
      "trae-ai",
      "kiro",
      "cline",
    ]);

    expect(stale).toHaveLength(3);
    expect(stale.map((s) => s.agent).sort()).toEqual([
      "cline",
      "kiro",
      "trae-ai",
    ]);
    // Each should have one stale file
    stale.forEach((group) => {
      expect(group.files).toEqual(["old.md"]);
    });
  });

  it("returns empty array for non-existent output directory", () => {
    const nonExistentDir = join(TEST_DIR, "does-not-exist");

    const sourceRules: SourceRuleInfo[] = [{ name: "rule1" }];
    const stale = detectStaleExports(nonExistentDir, sourceRules, ["cursor"]);

    expect(stale).toEqual([]);
  });

  it("handles case-insensitive matching of rule names", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/AI-Guidance.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/old-guidance.mdc"), "Content");

    // Source is lowercase
    const sourceRules: SourceRuleInfo[] = [{ name: "ai-guidance" }];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    expect(stale).toHaveLength(1);
    expect(stale[0].files).toEqual(["old-guidance.mdc"]);
  });

  it("detects all stale files across multiple exporters", () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".amazonq/rules"), { recursive: true });

    // Cursor: 2 files match, 1 stale
    writeFileSync(join(TEST_DIR, ".cursor/rules/rule1.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/rule2.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/stale1.mdc"), "Content");

    // AmazonQ: 1 file matches, 2 stale
    writeFileSync(join(TEST_DIR, ".amazonq/rules/rule1.md"), "Content");
    writeFileSync(join(TEST_DIR, ".amazonq/rules/stale2.md"), "Content");
    writeFileSync(join(TEST_DIR, ".amazonq/rules/stale3.md"), "Content");

    const sourceRules: SourceRuleInfo[] = [
      { name: "rule1" },
      { name: "rule2" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, [
      "cursor",
      "amazonq",
    ]);

    expect(stale).toHaveLength(2);

    const cursorStale = stale.find((s) => s.agent === "cursor");
    expect(cursorStale?.files).toEqual(["stale1.mdc"]);

    const amazonqStale = stale.find((s) => s.agent === "amazonq");
    expect(amazonqStale?.files).toEqual(["stale2.md", "stale3.md"]);
  });
});

describe("cleanStaleExports", () => {
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

  it("returns empty result when no stale groups provided", async () => {
    const result = await cleanStaleExports(TEST_DIR, []);

    expect(result.deleted).toEqual([]);
    expect(result.freedBytes).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it("deletes stale files from disk", async () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/old1.mdc"), "Old content");
    writeFileSync(join(TEST_DIR, ".cursor/rules/old2.mdc"), "Old");

    expect(existsSync(join(TEST_DIR, ".cursor/rules/old1.mdc"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/old2.mdc"))).toBe(true);

    const staleGroups = [
      {
        directory: ".cursor/rules",
        agent: "cursor",
        files: ["old1.mdc", "old2.mdc"],
      },
    ];

    const result = await cleanStaleExports(TEST_DIR, staleGroups);

    expect(result.deleted).toEqual(["old1.mdc", "old2.mdc"]);
    expect(result.warnings).toEqual([]);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/old1.mdc"))).toBe(false);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/old2.mdc"))).toBe(false);
  });

  it("calculates freed bytes correctly", async () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/old.mdc"), "12345"); // 5 bytes

    const staleGroups = [
      {
        directory: ".cursor/rules",
        agent: "cursor",
        files: ["old.mdc"],
      },
    ];

    const result = await cleanStaleExports(TEST_DIR, staleGroups);

    expect(result.freedBytes).toBe(5);
  });

  it("handles multiple stale groups across agents", async () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });
    mkdirSync(join(TEST_DIR, ".amazonq/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/old.mdc"), "Content");
    writeFileSync(join(TEST_DIR, ".amazonq/rules/old.md"), "Content");

    const staleGroups = [
      {
        directory: ".cursor/rules",
        agent: "cursor",
        files: ["old.mdc"],
      },
      {
        directory: ".amazonq/rules",
        agent: "amazonq",
        files: ["old.md"],
      },
    ];

    const result = await cleanStaleExports(TEST_DIR, staleGroups);

    expect(result.deleted).toEqual(["old.mdc", "old.md"]);
    expect(result.warnings).toEqual([]);
  });

  it("handles missing files gracefully with warnings", async () => {
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    const staleGroups = [
      {
        directory: ".cursor/rules",
        agent: "cursor",
        files: ["nonexistent.mdc"],
      },
    ];

    const result = await cleanStaleExports(TEST_DIR, staleGroups);

    expect(result.deleted).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Failed to delete");
  });

  it("integration: detect and clean stale exports", async () => {
    // Create export directories with mixed files
    mkdirSync(join(TEST_DIR, ".cursor/rules"), { recursive: true });

    writeFileSync(join(TEST_DIR, ".cursor/rules/security.mdc"), "Security");
    writeFileSync(join(TEST_DIR, ".cursor/rules/testing.mdc"), "Testing");
    writeFileSync(join(TEST_DIR, ".cursor/rules/old-rule.mdc"), "Old");

    // Detect stale (source has security and testing, old-rule is stale)
    const sourceRules: SourceRuleInfo[] = [
      { name: "security" },
      { name: "testing" },
    ];
    const stale = detectStaleExports(TEST_DIR, sourceRules, ["cursor"]);

    expect(stale).toHaveLength(1);
    expect(stale[0].files).toEqual(["old-rule.mdc"]);

    // Clean the stale exports
    const result = await cleanStaleExports(TEST_DIR, stale);

    expect(result.deleted).toEqual(["old-rule.mdc"]);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/security.mdc"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/testing.mdc"))).toBe(true);
    expect(existsSync(join(TEST_DIR, ".cursor/rules/old-rule.mdc"))).toBe(
      false,
    );
  });
});
