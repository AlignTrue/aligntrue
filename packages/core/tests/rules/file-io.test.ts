import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
  detectNonMdFiles,
  loadRulesDirectory,
  parseRuleFile,
  writeRuleFile,
} from "../../src/rules/file-io.js";

describe("file-io", () => {
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

    it("preserves source metadata in frontmatter", () => {
      const content =
        "---\ntitle: Imported Rule\nsource: https://github.com/org/rules\nsource_added: 2025-11-29\n---\n\n# Content";
      const filePath = join(rulesDir, "imported.md");
      writeFileSync(filePath, content);

      const parsed = parseRuleFile(filePath, testDir);
      expect(parsed.frontmatter.source).toBe("https://github.com/org/rules");
      expect(parsed.frontmatter.source_added).toBe("2025-11-29");
    });
  });
});
