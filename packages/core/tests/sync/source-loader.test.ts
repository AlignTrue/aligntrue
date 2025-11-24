/**
 * Tests for source-loader module
 */

import { describe, it, expect } from "vitest";
import {
  orderSourceFiles,
  mergeSourceFiles,
} from "../../src/sync/source-loader.js";

describe("source-loader", () => {
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
});
