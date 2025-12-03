import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  detectNonMdFiles,
  formatTitleFromFilename,
  loadRulesDirectory,
  parseRuleFile,
  writeRuleFile,
} from "../../src/rules/file-io.js";

// Skip on Windows due to glob path handling differences
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describe("formatTitleFromFilename", () => {
  it("converts snake_case to Title Case", () => {
    expect(formatTitleFromFilename("test_rule.md")).toBe("Test Rule");
    expect(formatTitleFromFilename("my_long_rule_name.md")).toBe(
      "My Long Rule Name",
    );
  });

  it("converts kebab-case to Title Case", () => {
    expect(formatTitleFromFilename("test-rule.md")).toBe("Test Rule");
    expect(formatTitleFromFilename("my-long-rule.md")).toBe("My Long Rule");
  });

  it("handles mixed separators", () => {
    expect(formatTitleFromFilename("test_rule-name.md")).toBe("Test Rule Name");
  });

  it("uppercases common acronyms", () => {
    expect(formatTitleFromFilename("ci_troubleshooting.md")).toBe(
      "CI Troubleshooting",
    );
    expect(formatTitleFromFilename("cli_testing_playbook.md")).toBe(
      "CLI Testing Playbook",
    );
    expect(formatTitleFromFilename("api_reference.md")).toBe("API Reference");
    expect(formatTitleFromFilename("pr_standards.md")).toBe("PR Standards");
  });

  it("handles single word filenames", () => {
    expect(formatTitleFromFilename("typescript.md")).toBe("Typescript");
    expect(formatTitleFromFilename("testing.md")).toBe("Testing");
  });

  it("handles files without .md extension", () => {
    expect(formatTitleFromFilename("test_rule")).toBe("Test Rule");
  });
});

describeSkipWindows("file-io", () => {
  let testDir: string;
  let rulesDir: string;

  beforeEach(() => {
    // Create temp directory
    testDir = join(
      tmpdir(),
      `aligntrue-fileio-test-${randomBytes(8).toString("hex")}`,
    );
    rulesDir = join(testDir, "rules");
    mkdirSync(rulesDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("detectNonMdFiles", () => {
    it("returns empty array when only .md files exist", async () => {
      writeFileSync(join(rulesDir, "rule1.md"), "# Rule 1");
      writeFileSync(join(rulesDir, "rule2.md"), "# Rule 2");

      const nonMdFiles = await detectNonMdFiles(rulesDir);
      expect(nonMdFiles).toHaveLength(0);
    });

    it("detects non-.md files", async () => {
      writeFileSync(join(rulesDir, "rule.md"), "# Rule");
      writeFileSync(join(rulesDir, "config.yaml"), "key: value");
      writeFileSync(join(rulesDir, "old-rule.mdc"), "# Old Rule");

      const nonMdFiles = await detectNonMdFiles(rulesDir);
      expect(nonMdFiles).toHaveLength(2);
      expect(nonMdFiles).toContain("config.yaml");
      expect(nonMdFiles).toContain("old-rule.mdc");
    });

    it("detects files in subdirectories", async () => {
      mkdirSync(join(rulesDir, "subdir"), { recursive: true });
      writeFileSync(join(rulesDir, "rule.md"), "# Rule");
      writeFileSync(join(rulesDir, "subdir", "nested.mdc"), "# Nested");

      const nonMdFiles = await detectNonMdFiles(rulesDir);
      expect(nonMdFiles).toHaveLength(1);
      expect(nonMdFiles[0]).toBe("subdir/nested.mdc");
    });

    it("ignores hidden files", async () => {
      writeFileSync(join(rulesDir, ".hidden"), "hidden content");
      writeFileSync(join(rulesDir, "rule.md"), "# Rule");

      const nonMdFiles = await detectNonMdFiles(rulesDir);
      expect(nonMdFiles).toHaveLength(0);
    });

    it("returns empty array for non-existent directory", async () => {
      const nonMdFiles = await detectNonMdFiles(join(testDir, "nonexistent"));
      expect(nonMdFiles).toHaveLength(0);
    });
  });

  describe("loadRulesDirectory", () => {
    it("loads all .md files from directory", async () => {
      writeFileSync(
        join(rulesDir, "rule1.md"),
        "---\ntitle: Rule 1\n---\n# Content",
      );
      writeFileSync(
        join(rulesDir, "rule2.md"),
        "---\ntitle: Rule 2\n---\n# Content",
      );

      const rules = await loadRulesDirectory(rulesDir, testDir);
      expect(rules).toHaveLength(2);
    });

    it("ignores non-.md files", async () => {
      writeFileSync(
        join(rulesDir, "rule.md"),
        "---\ntitle: Rule\n---\n# Content",
      );
      writeFileSync(join(rulesDir, "config.yaml"), "key: value");

      const rules = await loadRulesDirectory(rulesDir, testDir);
      expect(rules).toHaveLength(1);
      expect(rules[0]!.filename).toBe("rule.md");
    });

    it("loads files from subdirectories when recursive", async () => {
      mkdirSync(join(rulesDir, "subdir"), { recursive: true });
      writeFileSync(
        join(rulesDir, "root.md"),
        "---\ntitle: Root\n---\n# Content",
      );
      writeFileSync(
        join(rulesDir, "subdir", "nested.md"),
        "---\ntitle: Nested\n---\n# Content",
      );

      const rules = await loadRulesDirectory(rulesDir, testDir, {
        recursive: true,
      });
      expect(rules).toHaveLength(2);
    });
  });

  describe("parseRuleFile and writeRuleFile", () => {
    it("round-trips a rule file", () => {
      const content =
        "---\ntitle: Test Rule\ndescription: A test\n---\n\n# Test Content\n\nSome content here.";
      const filePath = join(rulesDir, "test.md");
      writeFileSync(filePath, content);

      const parsed = parseRuleFile(filePath, testDir);
      expect(parsed.frontmatter.title).toBe("Test Rule");
      expect(parsed.frontmatter.description).toBe("A test");
      expect(parsed.content).toContain("Test Content");

      // Write it back
      const outputPath = join(rulesDir, "output.md");
      writeRuleFile(outputPath, parsed);

      // Parse again
      const reparsed = parseRuleFile(outputPath, testDir);
      expect(reparsed.frontmatter.title).toBe("Test Rule");
      expect(reparsed.content).toContain("Test Content");
    });

    it("preserves unknown metadata in frontmatter (additionalProperties)", () => {
      // Test that unknown frontmatter fields are preserved (additionalProperties: true)
      const content =
        "---\ntitle: Imported Rule\ncustom_field: custom_value\n---\n\n# Content";
      const filePath = join(rulesDir, "imported.md");
      writeFileSync(filePath, content);

      const parsed = parseRuleFile(filePath, testDir);
      expect(
        (parsed.frontmatter as Record<string, unknown>)["custom_field"],
      ).toBe("custom_value");
    });
  });
});
