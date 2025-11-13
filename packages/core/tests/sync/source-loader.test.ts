/**
 * Tests for source-loader module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  discoverSourceFiles,
  orderSourceFiles,
  mergeSourceFiles,
  loadSourceFiles,
} from "../../src/sync/source-loader.js";
import type { AlignTrueConfig } from "../../src/config/index.js";

describe("source-loader", () => {
  let testDir: string;

  beforeEach(() => {
    // Create temp directory for tests
    testDir = join(tmpdir(), `aligntrue-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up temp directory
    if (testDir) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("discoverSourceFiles", () => {
    it("should discover single file", async () => {
      // Create test file
      writeFileSync(join(testDir, "AGENTS.md"), "# Test\n\nContent");

      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: "AGENTS.md",
        },
      };

      const files = await discoverSourceFiles(testDir, config);

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe("AGENTS.md");
      expect(files[0].content).toBe("# Test\n\nContent");
      expect(files[0].sections).toHaveLength(1);
    });

    it("should discover multiple files with glob pattern", async () => {
      // Note: glob output is normalized to forward slashes for cross-platform consistency
      // (prevents Windows backslash issues)
      // Create test files
      mkdirSync(join(testDir, "rules"), { recursive: true });
      writeFileSync(
        join(testDir, "rules/arch.md"),
        "# Architecture\n\nContent",
      );
      writeFileSync(
        join(testDir, "rules/security.md"),
        "# Security\n\nContent",
      );

      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: "rules/*.md",
        },
      };

      const files = await discoverSourceFiles(testDir, config);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.path).sort()).toEqual([
        "rules/arch.md",
        "rules/security.md",
      ]);
    });

    it("should discover files from array of patterns", async () => {
      // Create test files
      writeFileSync(join(testDir, "arch.md"), "# Architecture\n\nContent");
      writeFileSync(join(testDir, "security.md"), "# Security\n\nContent");

      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: ["arch.md", "security.md"],
        },
      };

      const files = await discoverSourceFiles(testDir, config);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.path).sort()).toEqual([
        "arch.md",
        "security.md",
      ]);
    });

    it("should return empty array if no files match", async () => {
      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: "nonexistent/*.md",
        },
      };

      const files = await discoverSourceFiles(testDir, config);

      expect(files).toHaveLength(0);
    });
  });

  describe("orderSourceFiles", () => {
    it("should order files alphabetically by default", () => {
      const files = [
        {
          path: "rules/zebra.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/alpha.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/beta.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
      ];

      const ordered = orderSourceFiles(files);

      expect(ordered.map((f) => f.path)).toEqual([
        "rules/alpha.md",
        "rules/beta.md",
        "rules/zebra.md",
      ]);
    });

    it("should order files by custom order", () => {
      const files = [
        {
          path: "rules/zebra.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/alpha.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/beta.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
      ];

      const ordered = orderSourceFiles(files, [
        "zebra.md",
        "alpha.md",
        "beta.md",
      ]);

      expect(ordered.map((f) => f.path)).toEqual([
        "rules/zebra.md",
        "rules/alpha.md",
        "rules/beta.md",
      ]);
    });

    it("should put unlisted files at the end alphabetically", () => {
      const files = [
        {
          path: "rules/zebra.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/alpha.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/beta.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
        {
          path: "rules/gamma.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
      ];

      const ordered = orderSourceFiles(files, ["alpha.md", "beta.md"]);

      expect(ordered.map((f) => f.path)).toEqual([
        "rules/alpha.md",
        "rules/beta.md",
        "rules/gamma.md",
        "rules/zebra.md",
      ]);
    });
  });

  describe("mergeSourceFiles", () => {
    it("should merge sections from multiple files", () => {
      const files = [
        {
          path: "arch.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [
            { heading: "Architecture", content: "Arch content", level: 1 },
          ],
        },
        {
          path: "security.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [
            { heading: "Security", content: "Security content", level: 1 },
          ],
        },
      ];

      const merged = mergeSourceFiles(files);

      expect(merged.sections).toHaveLength(2);
      expect(merged.sections[0].heading).toBe("Architecture");
      expect(merged.sections[1].heading).toBe("Security");
    });

    it("should add source file metadata to sections", () => {
      const files = [
        {
          path: "rules/arch.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [
            { heading: "Architecture", content: "Arch content", level: 1 },
          ],
        },
      ];

      const merged = mergeSourceFiles(files);

      expect(merged.sections[0].vendor?.aligntrue?.source_file).toBe("arch.md");
    });

    it("should handle empty sections array", () => {
      const files = [
        {
          path: "empty.md",
          absolutePath: "",
          content: "",
          mtime: new Date(),
          sections: [],
        },
      ];

      const merged = mergeSourceFiles(files);

      expect(merged.sections).toHaveLength(0);
    });
  });

  describe("loadSourceFiles", () => {
    it("should load and merge source files end-to-end", async () => {
      // Create test files
      mkdirSync(join(testDir, "rules"), { recursive: true });
      writeFileSync(
        join(testDir, "rules/arch.md"),
        "# Architecture\n\nArch content",
      );
      writeFileSync(
        join(testDir, "rules/security.md"),
        "# Security\n\nSecurity content",
      );

      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: "rules/*.md",
          source_order: ["security.md", "arch.md"],
        },
      };

      const pack = await loadSourceFiles(testDir, config);

      expect(pack.sections).toHaveLength(2);
      // Should be ordered by source_order
      expect(pack.sections[0].heading).toBe("Security");
      expect(pack.sections[1].heading).toBe("Architecture");
      // Should have source file metadata
      expect(pack.sections[0].vendor?.aligntrue?.source_file).toBe(
        "security.md",
      );
      expect(pack.sections[1].vendor?.aligntrue?.source_file).toBe("arch.md");
    });

    it("should return empty pack if no files found", async () => {
      const config: AlignTrueConfig = {
        exporters: ["cursor"],
        mode: "solo",
        sync: {
          source_files: "nonexistent/*.md",
        },
      };

      const pack = await loadSourceFiles(testDir, config);

      expect(pack.sections).toHaveLength(0);
    });
  });
});
