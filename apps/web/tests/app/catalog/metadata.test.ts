/**
 * Tests for pack metadata generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generatePackMetadata,
  generatePackStructuredData,
} from "@/app/catalog/[slug]/metadata";
import type { CatalogEntryExtended } from "@aligntrue/schema";

describe("Pack metadata generation", () => {
  const mockPack: CatalogEntryExtended = {
    id: "aligntrue/aligns:packs/base/base-global",
    slug: "base-global",
    name: "Base Global",
    version: "1.0.0",
    description: "Global baseline rules for AI code agents",
    published_at: "2025-10-01T00:00:00Z",
    last_updated: "2025-10-31T00:00:00Z",
    license: "CC0-1.0",
    categories: ["best-practices", "code-quality"],
    compatible_tools: ["cursor", "claude-code"],
    maintainer: {
      name: "AlignTrue Team",
      github: "aligntrue",
    },
    source_repo: "https://github.com/AlignTrue/aligns",
    stats: {
      copies_7d: 150,
      copies_30d: 500,
      views_7d: 1000,
      trending_score: 0.95,
    },
    summary_bullets: ["Rule 1", "Rule 2"],
    exporters: [],
    plugs: [],
    required_plugs: [],
    overlay_friendly: true,
    source_linked: true,
    rules_index: [],
  };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://aligntrue.ai";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("generatePackMetadata", () => {
    it("should generate complete metadata for a pack", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.title).toBe("Base Global v1.0.0 - AlignTrue Catalog");
      expect(metadata.description).toBe(
        "Global baseline rules for AI code agents",
      );
      expect(metadata.keywords).toContain("best-practices");
      expect(metadata.keywords).toContain("cursor");
    });

    it("should include OpenGraph metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.openGraph).toBeDefined();
      expect(metadata.openGraph?.title).toBe(
        "Base Global v1.0.0 - AlignTrue Catalog",
      );
      expect(metadata.openGraph?.url).toBe(
        "https://aligntrue.ai/catalog/base-global",
      );
      expect(metadata.openGraph?.type).toBe("article");
    });

    it("should include Twitter card metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.twitter).toBeDefined();
      expect(metadata.twitter?.card).toBe("summary_large_image");
    });

    it("should set canonical URL", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.alternates?.canonical).toBe(
        "https://aligntrue.ai/catalog/base-global",
      );
    });

    it("should include version and license in other metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [mockPack] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.other?.version).toBe("1.0.0");
      expect(metadata.other?.license).toBe("CC0-1.0");
    });

    it("should return fallback metadata when pack not found", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ packs: [] }),
      });
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("nonexistent");

      expect(metadata.title).toBe("nonexistent - AlignTrue Catalog");
      expect(metadata.description).toBe("AI-native rules and alignment pack");
    });

    it("should return fallback metadata on fetch error", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      global.fetch = mockFetch;

      const metadata = await generatePackMetadata("base-global");

      expect(metadata.title).toBe("base-global - AlignTrue Catalog");
    });
  });

  describe("generatePackStructuredData", () => {
    it("should generate JSON-LD structured data", () => {
      const structuredData = generatePackStructuredData(mockPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed["@context"]).toBe("https://schema.org");
      expect(parsed["@type"]).toBe("SoftwareSourceCode");
      expect(parsed.name).toBe("Base Global");
      expect(parsed.version).toBe("1.0.0");
    });

    it("should include author information", () => {
      const structuredData = generatePackStructuredData(mockPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed.author["@type"]).toBe("Person");
      expect(parsed.author.name).toBe("AlignTrue Team");
      expect(parsed.author.url).toBe("https://github.com/aligntrue");
    });

    it("should include code repository if available", () => {
      const structuredData = generatePackStructuredData(mockPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed.codeRepository).toBe("https://github.com/AlignTrue/aligns");
    });

    it("should include aggregate rating for popular packs", () => {
      const structuredData = generatePackStructuredData(mockPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed.aggregateRating).toBeDefined();
      expect(parsed.aggregateRating.reviewCount).toBe(150);
    });

    it("should omit aggregate rating for new packs", () => {
      const newPack = {
        ...mockPack,
        stats: { ...mockPack.stats, copies_7d: 0 },
      };

      const structuredData = generatePackStructuredData(newPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed.aggregateRating).toBeUndefined();
    });

    it("should include keywords from categories and tools", () => {
      const structuredData = generatePackStructuredData(mockPack);
      const parsed = JSON.parse(structuredData);

      expect(parsed.keywords).toContain("best-practices");
      expect(parsed.keywords).toContain("cursor");
    });
  });
});
