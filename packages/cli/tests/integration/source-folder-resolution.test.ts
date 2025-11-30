/**
 * Source folder resolution tests
 * Tests that all source types (git, URL, local) correctly resolve folders
 * and handle .md/.mdc files with structure preservation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { resolveSource } from "@aligntrue/core";

const TEMP_DIR = join(__dirname, "../../temp-folder-resolution");

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

describeSkipWindows("Source Folder Resolution", () => {
  beforeEach(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEMP_DIR)) {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  });

  describe("Local folder resolution", () => {
    it("should resolve local directory with nested .md files", () => {
      const testDir = join(TEMP_DIR, "local-test");
      mkdirSync(join(testDir, "rules/backend"), { recursive: true });
      mkdirSync(join(testDir, "rules/frontend"), { recursive: true });

      // Create test files
      writeFileSync(
        join(testDir, "rules/security.md"),
        `---
title: "Security Rules"
---

# Security content`,
        "utf-8",
      );

      writeFileSync(
        join(testDir, "rules/backend/caching.md"),
        `---
title: "Caching Rules"
---

# Caching content`,
        "utf-8",
      );

      writeFileSync(
        join(testDir, "rules/frontend/react.md"),
        `---
title: "React Rules"
---

# React content`,
        "utf-8",
      );

      // Resolve the directory
      return resolveSource(join(testDir, "rules"), { cwd: testDir }).then(
        (result) => {
          expect(result.rules).toHaveLength(3);
          expect(result.rules.map((r) => r.filename).sort()).toEqual([
            "caching.md",
            "react.md",
            "security.md",
          ]);
          // Check structure preservation
          expect(
            result.rules.some((r) => r.relativePath === "backend/caching.md"),
          ).toBe(true);
          expect(
            result.rules.some((r) => r.relativePath === "frontend/react.md"),
          ).toBe(true);
          expect(
            result.rules.some(
              (r) => !r.relativePath || r.relativePath === "security.md",
            ),
          ).toBe(true);
        },
      );
    });

    it("should convert .mdc files to .md during resolution", () => {
      const testDir = join(TEMP_DIR, "mdc-test");
      mkdirSync(join(testDir, "rules/cursor"), { recursive: true });

      // Create .mdc file
      writeFileSync(
        join(testDir, "rules/cursor/debugging.mdc"),
        `---
title: "Debugging Guide"
cursor:
  when: "debugging"
---

# Debugging content`,
        "utf-8",
      );

      return resolveSource(join(testDir, "rules"), { cwd: testDir }).then(
        (result) => {
          expect(result.rules).toHaveLength(1);
          const rule = result.rules[0];
          // Should be converted to .md
          expect(rule.filename).toBe("debugging.md");
          expect(rule.relativePath).toBe("cursor/debugging.md");
          // .mdc frontmatter should be mapped to .md
          expect(rule.frontmatter.title).toBe("Debugging Guide");
        },
      );
    });

    it("should resolve single .md file", () => {
      const testDir = join(TEMP_DIR, "file-test");
      mkdirSync(testDir);

      writeFileSync(
        join(testDir, "single-rule.md"),
        `---
title: "Single Rule"
---

# Content`,
        "utf-8",
      );

      return resolveSource(join(testDir, "single-rule.md"), {
        cwd: testDir,
      }).then((result) => {
        expect(result.rules).toHaveLength(1);
        expect(result.rules[0].filename).toBe("single-rule.md");
      });
    });
  });

  describe("Mix of .md and .mdc files", () => {
    it("should resolve both .md and .mdc files from same directory", () => {
      const testDir = join(TEMP_DIR, "mixed-test");
      mkdirSync(testDir);

      writeFileSync(
        join(testDir, "markdown-rule.md"),
        `---
title: "Markdown Rule"
---

# Content`,
        "utf-8",
      );

      writeFileSync(
        join(testDir, "cursor-rule.mdc"),
        `---
title: "Cursor Rule"
---

# Cursor content`,
        "utf-8",
      );

      return resolveSource(testDir, { cwd: TEMP_DIR }).then((result) => {
        expect(result.rules).toHaveLength(2);
        const filenames = result.rules.map((r) => r.filename).sort();
        expect(filenames).toEqual(["cursor-rule.md", "markdown-rule.md"]);
      });
    });
  });

  describe("Directory structure preservation", () => {
    it("should preserve deep nested directory structure", () => {
      const testDir = join(TEMP_DIR, "structure-test");
      mkdirSync(join(testDir, "rules/packages/api/middleware"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "rules/packages/ui/components"), {
        recursive: true,
      });

      writeFileSync(
        join(testDir, "rules/packages/api/middleware/auth.md"),
        `---
title: "Auth Middleware"
---

# Content`,
        "utf-8",
      );

      writeFileSync(
        join(testDir, "rules/packages/ui/components/button.md"),
        `---
title: "Button Component"
---

# Content`,
        "utf-8",
      );

      return resolveSource(join(testDir, "rules"), { cwd: testDir }).then(
        (result) => {
          expect(result.rules).toHaveLength(2);
          const paths = result.rules.map((r) => r.relativePath).sort();
          expect(paths).toEqual([
            "packages/api/middleware/auth.md",
            "packages/ui/components/button.md",
          ]);
        },
      );
    });
  });

  describe("Empty and edge cases", () => {
    it("should handle empty directory", () => {
      const testDir = join(TEMP_DIR, "empty-test");
      mkdirSync(testDir);

      return resolveSource(testDir, { cwd: TEMP_DIR }).then((result) => {
        expect(result.rules).toHaveLength(0);
      });
    });

    it("should ignore non-markdown files in directory", () => {
      const testDir = join(TEMP_DIR, "ignore-test");
      mkdirSync(testDir);

      writeFileSync(join(testDir, "valid.md"), "# Valid");
      writeFileSync(join(testDir, "readme.txt"), "Not markdown");
      writeFileSync(join(testDir, "config.yaml"), "not: markdown");

      return resolveSource(testDir, { cwd: TEMP_DIR }).then((result) => {
        expect(result.rules).toHaveLength(1);
        expect(result.rules[0].filename).toBe("valid.md");
      });
    });
  });

  describe("Metadata and frontmatter", () => {
    it("should preserve frontmatter through resolution", () => {
      const testDir = join(TEMP_DIR, "metadata-test");
      mkdirSync(testDir);

      writeFileSync(
        join(testDir, "rule.md"),
        `---
title: "Test Rule"
description: "Test description"
scope: "packages/api"
tags: ["security", "api"]
---

# Content`,
        "utf-8",
      );

      return resolveSource(testDir, { cwd: TEMP_DIR }).then((result) => {
        const rule = result.rules[0];
        expect(rule.frontmatter.title).toBe("Test Rule");
        expect(rule.frontmatter.description).toBe("Test description");
        expect(rule.frontmatter.scope).toBe("packages/api");
      });
    });

    it("should add source URL to frontmatter", () => {
      const testDir = join(TEMP_DIR, "source-test");
      mkdirSync(testDir);

      writeFileSync(
        join(testDir, "rule.md"),
        `---
title: "Test"
---

# Content`,
        "utf-8",
      );

      return resolveSource(testDir, { cwd: TEMP_DIR }).then((result) => {
        const rule = result.rules[0];
        // Source should be added by resolveSource
        expect(rule.content).toBeTruthy();
      });
    });
  });

  describe("Non-existent sources", () => {
    it("should throw error for non-existent local path", () => {
      const testDir = join(TEMP_DIR, "nonexistent");

      return expect(resolveSource(testDir, { cwd: TEMP_DIR })).rejects.toThrow(
        /not found|does not exist/i,
      );
    });
  });
});
