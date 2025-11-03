import { describe, it, expect } from "vitest";
import {
  validateCatalogEntry,
  validateCatalogIndex,
  type CatalogEntryExtended,
  type CatalogIndexExtended,
  type PreviewMeta,
  type ExporterPreview,
} from "../src/catalog-entry.js";

describe("CatalogEntry Validation", () => {
  const validPreviewMeta: PreviewMeta = {
    engine_version: "0.1.0",
    canonical_yaml_sha: "abc123",
    rendered_at: "2025-10-31T12:00:00.000Z",
  };

  const validExporterPreview: ExporterPreview = {
    format: "yaml",
    preview: "# Preview content",
    preview_meta: validPreviewMeta,
  };

  const validCatalogEntry: CatalogEntryExtended = {
    id: "packs/test/example",
    version: "1.0.0",
    name: "Example Pack",
    slug: "example",
    description: "An example pack for testing",
    summary_bullets: ["Feature 1", "Feature 2", "Feature 3"],
    categories: ["testing"],
    tags: ["test", "example"],
    compatible_tools: ["cursor", "claude-code"],
    license: "MIT",
    maintainer: {
      name: "Test Author",
      github: "testauthor",
    },
    last_updated: "2025-10-31T12:00:00.000Z",
    stats: {
      copies_7d: 42,
    },
    has_plugs: true,
    overlay_friendly: false,
    required_plugs_count: 2,
    exporters: [validExporterPreview],
  };

  describe("validateCatalogEntry", () => {
    it("validates a complete catalog entry", () => {
      const result = validateCatalogEntry(validCatalogEntry);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("rejects non-object input", () => {
      const result = validateCatalogEntry("not an object");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entry must be an object");
    });

    it("rejects null input", () => {
      const result = validateCatalogEntry(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Entry must be an object");
    });

    it("detects missing required field: id", () => {
      const { id, ...incomplete } = validCatalogEntry;
      const result = validateCatalogEntry(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: id");
    });

    it("detects missing required field: version", () => {
      const { version, ...incomplete } = validCatalogEntry;
      const result = validateCatalogEntry(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: version");
    });

    it("detects missing required field: name", () => {
      const { name, ...incomplete } = validCatalogEntry;
      const result = validateCatalogEntry(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: name");
    });

    it("detects missing required field: exporters", () => {
      const { exporters, ...incomplete } = validCatalogEntry;
      const result = validateCatalogEntry(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required field: exporters");
    });

    it("validates type: id must be string", () => {
      const invalid = { ...validCatalogEntry, id: 123 };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("id must be a string");
    });

    it("validates type: version must be string", () => {
      const invalid = { ...validCatalogEntry, version: 1.0 };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("version must be a string");
    });

    it("validates type: summary_bullets must be array", () => {
      const invalid = { ...validCatalogEntry, summary_bullets: "not array" };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("summary_bullets must be an array");
    });

    it("validates type: categories must be array", () => {
      const invalid = { ...validCatalogEntry, categories: "not array" };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("categories must be an array");
    });

    it("validates type: has_plugs must be boolean", () => {
      const invalid = { ...validCatalogEntry, has_plugs: "yes" };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("has_plugs must be a boolean");
    });

    it("validates type: overlay_friendly must be boolean", () => {
      const invalid = { ...validCatalogEntry, overlay_friendly: 1 };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("overlay_friendly must be a boolean");
    });

    it("validates type: required_plugs_count must be number", () => {
      const invalid = { ...validCatalogEntry, required_plugs_count: "two" };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("required_plugs_count must be a number");
    });

    it("validates maintainer structure", () => {
      const invalid = { ...validCatalogEntry, maintainer: { github: "test" } };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "maintainer.name is required and must be a string",
      );
    });

    it("validates stats structure: copies_7d required", () => {
      const invalid = { ...validCatalogEntry, stats: {} };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "stats.copies_7d must be a non-negative number",
      );
    });

    it("validates stats structure: copies_7d must be non-negative", () => {
      const invalid = { ...validCatalogEntry, stats: { copies_7d: -5 } };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "stats.copies_7d must be a non-negative number",
      );
    });

    it("validates exporters must be array", () => {
      const invalid = { ...validCatalogEntry, exporters: "not array" };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("exporters must be an array");
    });

    it("validates exporter format field", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [{ preview: "content", preview_meta: validPreviewMeta }],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("format"))).toBe(true);
    });

    it("validates exporter preview field", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [{ format: "yaml", preview_meta: validPreviewMeta }],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("preview"))).toBe(true);
    });

    it("validates exporter preview_meta field", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [{ format: "yaml", preview: "content" }],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("preview_meta"))).toBe(true);
    });

    it("validates preview_meta.engine_version", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [
          {
            format: "yaml",
            preview: "content",
            preview_meta: {
              canonical_yaml_sha: "abc",
              rendered_at: "2025-10-31",
            },
          },
        ],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("engine_version"))).toBe(
        true,
      );
    });

    it("validates preview_meta.canonical_yaml_sha", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [
          {
            format: "yaml",
            preview: "content",
            preview_meta: {
              engine_version: "1.0.0",
              rendered_at: "2025-10-31",
            },
          },
        ],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("canonical_yaml_sha"))).toBe(
        true,
      );
    });

    it("validates preview_meta.rendered_at", () => {
      const invalid = {
        ...validCatalogEntry,
        exporters: [
          {
            format: "yaml",
            preview: "content",
            preview_meta: {
              engine_version: "1.0.0",
              canonical_yaml_sha: "abc",
            },
          },
        ],
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("rendered_at"))).toBe(true);
    });

    it("accepts optional fields: source_repo", () => {
      const withSourceRepo = {
        ...validCatalogEntry,
        source_repo: "https://github.com/test/repo",
      };
      const result = validateCatalogEntry(withSourceRepo);
      expect(result.valid).toBe(true);
    });

    it("accepts optional fields: namespace_owner", () => {
      const withNamespace = {
        ...validCatalogEntry,
        namespace_owner: "test-org",
      };
      const result = validateCatalogEntry(withNamespace);
      expect(result.valid).toBe(true);
    });

    it("accepts optional fields: required_plugs", () => {
      const withPlugs = {
        ...validCatalogEntry,
        required_plugs: [
          {
            key: "test.cmd",
            description: "Test command",
            type: "string",
          },
        ],
      };
      const result = validateCatalogEntry(withPlugs);
      expect(result.valid).toBe(true);
    });

    it("accepts optional fields: rules_index", () => {
      const withRulesIndex = {
        ...validCatalogEntry,
        overlay_friendly: true,
        rules_index: [
          {
            id: "rule-1",
            path: "rules/rule-1.yaml",
            content_sha: "def456",
          },
        ],
      };
      const result = validateCatalogEntry(withRulesIndex);
      expect(result.valid).toBe(true);
    });

    it("accepts optional attribution field with original type", () => {
      const withAttribution = {
        ...validCatalogEntry,
        attribution: {
          type: "original",
          author: "AlignTrue",
          source_url: "https://github.com/AlignTrue/aligntrue",
        },
      };
      const result = validateCatalogEntry(withAttribution);
      expect(result.valid).toBe(true);
    });

    it("accepts optional attribution field with community type", () => {
      const withAttribution = {
        ...validCatalogEntry,
        attribution: {
          type: "community",
          author: "@username on X",
          source_url: "https://x.com/username/status/123456",
        },
      };
      const result = validateCatalogEntry(withAttribution);
      expect(result.valid).toBe(true);
    });

    it("validates attribution.type must be original or community", () => {
      const invalid = {
        ...validCatalogEntry,
        attribution: {
          type: "invalid",
          author: "Test",
          source_url: "https://example.com",
        },
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'attribution.type must be "original" or "community"',
      );
    });

    it("validates attribution.author is required", () => {
      const invalid = {
        ...validCatalogEntry,
        attribution: {
          type: "original",
          source_url: "https://example.com",
        },
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "attribution.author is required and must be a string",
      );
    });

    it("validates attribution.source_url is required", () => {
      const invalid = {
        ...validCatalogEntry,
        attribution: {
          type: "original",
          author: "Test",
        },
      };
      const result = validateCatalogEntry(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "attribution.source_url is required and must be a string",
      );
    });

    it("accepts multiple exporters", () => {
      const multiExporters = {
        ...validCatalogEntry,
        exporters: [
          validExporterPreview,
          {
            format: "agents-md",
            preview: "# AGENTS.md preview",
            preview_meta: validPreviewMeta,
          },
          {
            format: "cursor",
            preview: "# Cursor preview",
            preview_meta: validPreviewMeta,
          },
        ],
      };
      const result = validateCatalogEntry(multiExporters);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateCatalogIndex", () => {
    const validCatalogIndex: CatalogIndexExtended = {
      version: "1.0.0",
      generated_at: "2025-10-31T12:00:00.000Z",
      engine_version: "0.1.0",
      packs: [validCatalogEntry],
    };

    it("validates a complete catalog index", () => {
      const result = validateCatalogIndex(validCatalogIndex);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("rejects non-object input", () => {
      const result = validateCatalogIndex("not an object");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Index must be an object");
    });

    it("rejects null input", () => {
      const result = validateCatalogIndex(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Index must be an object");
    });

    it("detects missing version field", () => {
      const { version, ...incomplete } = validCatalogIndex;
      const result = validateCatalogIndex(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "version is required and must be a string",
      );
    });

    it("detects missing generated_at field", () => {
      const { generated_at, ...incomplete } = validCatalogIndex;
      const result = validateCatalogIndex(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "generated_at is required and must be a string",
      );
    });

    it("detects missing engine_version field", () => {
      const { engine_version, ...incomplete } = validCatalogIndex;
      const result = validateCatalogIndex(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "engine_version is required and must be a string",
      );
    });

    it("detects missing packs field", () => {
      const { packs, ...incomplete } = validCatalogIndex;
      const result = validateCatalogIndex(incomplete);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("packs is required and must be an array");
    });

    it("validates packs must be array", () => {
      const invalid = { ...validCatalogIndex, packs: "not array" };
      const result = validateCatalogIndex(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("packs is required and must be an array");
    });

    it("validates each pack entry in array", () => {
      const { id, ...invalidPack } = validCatalogEntry;
      const invalid = { ...validCatalogIndex, packs: [invalidPack] };
      const result = validateCatalogIndex(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("packs[0]"))).toBe(true);
      expect(
        result.errors?.some((e) => e.includes("Missing required field: id")),
      ).toBe(true);
    });

    it("validates multiple pack entries", () => {
      const secondPack = {
        ...validCatalogEntry,
        id: "packs/test/second",
        slug: "second",
      };
      const valid = {
        ...validCatalogIndex,
        packs: [validCatalogEntry, secondPack],
      };
      const result = validateCatalogIndex(valid);
      expect(result.valid).toBe(true);
    });

    it("reports errors for specific pack indices", () => {
      const { version: v1, ...invalidPack1 } = validCatalogEntry;
      const { name: n2, ...invalidPack2 } = {
        ...validCatalogEntry,
        id: "packs/test/second",
      };
      const invalid = {
        ...validCatalogIndex,
        packs: [invalidPack1, invalidPack2],
      };
      const result = validateCatalogIndex(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors?.some((e) => e.includes("packs[0]"))).toBe(true);
      expect(result.errors?.some((e) => e.includes("packs[1]"))).toBe(true);
    });

    it("accepts empty packs array", () => {
      const empty = { ...validCatalogIndex, packs: [] };
      const result = validateCatalogIndex(empty);
      expect(result.valid).toBe(true);
    });
  });

  describe("Type Exports", () => {
    it("exports CatalogEntryExtended type", () => {
      const entry: CatalogEntryExtended = validCatalogEntry;
      expect(entry.id).toBe("packs/test/example");
    });

    it("exports CatalogIndexExtended type", () => {
      const index: CatalogIndexExtended = {
        version: "1.0.0",
        generated_at: "2025-10-31T12:00:00.000Z",
        engine_version: "0.1.0",
        packs: [],
      };
      expect(index.version).toBe("1.0.0");
    });

    it("exports PreviewMeta type", () => {
      const meta: PreviewMeta = validPreviewMeta;
      expect(meta.engine_version).toBe("0.1.0");
    });

    it("exports ExporterPreview type", () => {
      const preview: ExporterPreview = validExporterPreview;
      expect(preview.format).toBe("yaml");
    });
  });
});
