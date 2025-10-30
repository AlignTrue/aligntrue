import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  checkFileSize,
  createIgnoreFilter,
} from "../../src/performance/index.js";

describe("Performance Guardrails", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `aligntrue-perf-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("checkFileSize", () => {
    it("passes when file is under limit", () => {
      const filePath = join(testDir, "small.txt");
      writeFileSync(filePath, "small content", "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "solo", false);
      }).not.toThrow();
    });

    it("warns in solo mode when file exceeds limit", () => {
      const filePath = join(testDir, "large.txt");
      const content = "x".repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(filePath, content, "utf-8");

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => {
        checkFileSize(filePath, 10, "solo", false);
      }).not.toThrow();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("File exceeds size limit"),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("11.00MB > 10MB"),
      );

      warnSpy.mockRestore();
    });

    it("throws error in team mode when file exceeds limit", () => {
      const filePath = join(testDir, "large.txt");
      const content = "x".repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(filePath, content, "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "team", false);
      }).toThrow("File exceeds size limit");
      expect(() => {
        checkFileSize(filePath, 10, "team", false);
      }).toThrow("11.00MB > 10MB");
      expect(() => {
        checkFileSize(filePath, 10, "team", false);
      }).toThrow("Use --force to override");
    });

    it("throws error in enterprise mode when file exceeds limit", () => {
      const filePath = join(testDir, "large.txt");
      const content = "x".repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(filePath, content, "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "enterprise", false);
      }).toThrow("File exceeds size limit");
    });

    it("bypasses check with force flag in solo mode", () => {
      const filePath = join(testDir, "large.txt");
      const content = "x".repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(filePath, content, "utf-8");

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      expect(() => {
        checkFileSize(filePath, 10, "solo", true);
      }).not.toThrow();

      // Should not warn when force is true
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("bypasses check with force flag in team mode", () => {
      const filePath = join(testDir, "large.txt");
      const content = "x".repeat(11 * 1024 * 1024); // 11MB
      writeFileSync(filePath, content, "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "team", true);
      }).not.toThrow();
    });

    it("throws error when file does not exist", () => {
      const filePath = join(testDir, "nonexistent.txt");

      expect(() => {
        checkFileSize(filePath, 10, "solo", false);
      }).toThrow("File not found");
    });

    it("handles exactly at limit correctly", () => {
      const filePath = join(testDir, "exact.txt");
      const content = "x".repeat(10 * 1024 * 1024); // Exactly 10MB
      writeFileSync(filePath, content, "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "team", false);
      }).not.toThrow();
    });

    it("handles small files efficiently", () => {
      const filePath = join(testDir, "tiny.txt");
      writeFileSync(filePath, "a", "utf-8");

      expect(() => {
        checkFileSize(filePath, 10, "team", false);
      }).not.toThrow();
    });
  });

  describe("createIgnoreFilter", () => {
    it("returns filter that ignores nothing when no patterns provided", () => {
      const filter = createIgnoreFilter();

      expect(filter("src/index.ts")).toBe(false);
      expect(filter("node_modules/pkg/index.js")).toBe(false);
      expect(filter(".git/config")).toBe(false);
    });

    it("respects .gitignore patterns", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "node_modules/\n*.log\n.env\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("node_modules/pkg/index.js")).toBe(true);
      expect(filter("debug.log")).toBe(true);
      expect(filter(".env")).toBe(true);
      expect(filter("src/index.ts")).toBe(false);
    });

    it("handles negation patterns correctly", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "*.log\n!important.log\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("debug.log")).toBe(true);
      expect(filter("important.log")).toBe(false); // Negated
      expect(filter("src/index.ts")).toBe(false);
    });

    it("handles additional patterns from config", () => {
      const filter = createIgnoreFilter(undefined, ["*.tmp", ".DS_Store"]);

      expect(filter("temp.tmp")).toBe(true);
      expect(filter(".DS_Store")).toBe(true);
      expect(filter("src/index.ts")).toBe(false);
    });

    it("combines .gitignore and additional patterns", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "node_modules/\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath, ["*.log"]);

      expect(filter("node_modules/pkg/index.js")).toBe(true); // From .gitignore
      expect(filter("debug.log")).toBe(true); // From additional patterns
      expect(filter("src/index.ts")).toBe(false);
    });

    it("handles missing .gitignore gracefully", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const gitignorePath = join(testDir, "nonexistent.gitignore");
      const filter = createIgnoreFilter(gitignorePath);

      // Should not warn for missing file (only for unreadable existing files)
      expect(filter("src/index.ts")).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it("normalizes paths with leading ./", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "node_modules/\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("./node_modules/pkg/index.js")).toBe(true);
      expect(filter("node_modules/pkg/index.js")).toBe(true);
    });

    it("normalizes paths with leading /", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "node_modules/\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("/node_modules/pkg/index.js")).toBe(true);
      expect(filter("node_modules/pkg/index.js")).toBe(true);
    });

    it("handles directory patterns correctly", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "build/\ndist/\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("build/index.js")).toBe(true);
      expect(filter("dist/bundle.js")).toBe(true);
      expect(filter("src/build.ts")).toBe(false);
    });

    it("handles wildcard patterns correctly", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "*.test.ts\n*.spec.js\n", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("src/index.test.ts")).toBe(true);
      expect(filter("tests/unit.spec.js")).toBe(true);
      expect(filter("src/index.ts")).toBe(false);
    });

    it("handles comment lines in .gitignore", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(
        gitignorePath,
        "# Dependencies\nnode_modules/\n\n# Logs\n*.log\n",
        "utf-8",
      );

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("node_modules/pkg/index.js")).toBe(true);
      expect(filter("debug.log")).toBe(true);
      expect(filter("# Dependencies")).toBe(false);
    });

    it("handles empty .gitignore file", () => {
      const gitignorePath = join(testDir, ".gitignore");
      writeFileSync(gitignorePath, "", "utf-8");

      const filter = createIgnoreFilter(gitignorePath);

      expect(filter("src/index.ts")).toBe(false);
      expect(filter("node_modules/pkg/index.js")).toBe(false);
    });
  });
});
