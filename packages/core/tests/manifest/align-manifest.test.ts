/**
 * Tests for parseAlignManifest
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { parseAlignManifest } from "../../src/manifest/align-manifest.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

describe("parseAlignManifest", () => {
  describe("valid manifests", () => {
    it("parses a minimal valid manifest", () => {
      const content = `
id: author/pack-name
version: 1.0.0
`;
      const result = parseAlignManifest(content);

      expect(result.manifest.id).toBe("author/pack-name");
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.warnings).toHaveLength(0);
    });

    it("parses a manifest with all fields", () => {
      const content = `
id: aligntrue/example-starter
version: 1.0.0
summary: "Example starter pack"
author: "@aligntrue"
license: MIT
includes:
  rules:
    - "rules/*.md"
  skills:
    - "skills/*.md"
`;
      const result = parseAlignManifest(content);

      expect(result.manifest.id).toBe("aligntrue/example-starter");
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.manifest.summary).toBe("Example starter pack");
      expect(result.manifest.author).toBe("@aligntrue");
      expect(result.manifest.license).toBe("MIT");
      expect(result.manifest.includes?.rules).toEqual(["rules/*.md"]);
      expect(result.manifest.includes?.skills).toEqual(["skills/*.md"]);
      expect(result.warnings).toHaveLength(0);
    });

    it("normalizes empty includes arrays by removing them", () => {
      const content = `
id: author/pack
version: 1.0.0
includes:
  rules: []
  skills:
    - "skills/*.md"
`;
      const result = parseAlignManifest(content);

      expect(result.manifest.includes?.rules).toBeUndefined();
      expect(result.manifest.includes?.skills).toEqual(["skills/*.md"]);
    });
  });

  describe("missing required fields", () => {
    it("throws when id is missing", () => {
      const content = `
version: 1.0.0
`;
      expect(() => parseAlignManifest(content)).toThrow(
        /missing required 'id'/i,
      );
    });

    it("throws when version is missing", () => {
      const content = `
id: author/pack
`;
      expect(() => parseAlignManifest(content)).toThrow(
        /missing required 'version'/i,
      );
    });
  });

  describe("non-standard id warning", () => {
    it("warns when id does not match author/name format", () => {
      const content = `
id: my-pack
version: 1.0.0
`;
      const result = parseAlignManifest(content);

      expect(result.manifest.id).toBe("my-pack");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("non-standard");
    });

    it("warns when id uses uppercase", () => {
      const content = `
id: Author/PackName
version: 1.0.0
`;
      const result = parseAlignManifest(content);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("non-standard");
    });
  });

  describe("invalid content", () => {
    it("throws on empty content", () => {
      expect(() => parseAlignManifest("")).toThrow(/empty/i);
    });

    it("throws on whitespace-only content", () => {
      expect(() => parseAlignManifest("   \n  \n  ")).toThrow(/empty/i);
    });

    it("throws on invalid YAML", () => {
      const content = `
id: author/pack
version: 1.0.0
  invalid: indentation
`;
      expect(() => parseAlignManifest(content)).toThrow(/failed to parse/i);
    });

    it("throws when content is not an object", () => {
      const content = `just a string`;
      expect(() => parseAlignManifest(content)).toThrow(
        /must be a YAML object/i,
      );
    });
  });

  describe("manifestPath option", () => {
    it("includes path in error messages when provided", () => {
      const content = `version: 1.0.0`;

      expect(() =>
        parseAlignManifest(content, { manifestPath: "path/to/.align.yaml" }),
      ).toThrow(/path\/to\/.align.yaml/);
    });
  });

  describe("example pack fixture", () => {
    it("parses the real example-pack manifest", () => {
      const examplePackPath = join(
        __dirname,
        "../../../../examples/example-pack/.align.yaml",
      );
      const content = readFileSync(examplePackPath, "utf-8");
      const result = parseAlignManifest(content);

      expect(result.manifest.id).toBe("aligntrue/example-starter");
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.manifest.includes?.rules).toContain("rules/*.md");
      expect(result.warnings).toHaveLength(0);
    });

    it("parses the stress-pack manifest with nested includes", () => {
      const stressPackPath = join(
        __dirname,
        "../../../../examples/.align.yaml",
      );
      const content = readFileSync(stressPackPath, "utf-8");
      const result = parseAlignManifest(content);

      expect(result.manifest.id).toBe("aligntrue/stress-pack");
      expect(result.manifest.version).toBe("1.0.0");
      expect(result.manifest.includes?.rules).toHaveLength(3);
      expect(result.manifest.includes?.rules).toContain("aligns/*.md");
      expect(result.manifest.includes?.rules).toContain(
        "remote-test/large-rules/*.md",
      );
      expect(result.manifest.includes?.rules).toContain(
        "multi-file-rules/rules/*.md",
      );
      expect(result.warnings).toHaveLength(0);
    });
  });
});
