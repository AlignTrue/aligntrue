/**
 * Search utilities tests (Phase 4, Session 2)
 *
 * Tests for Fuse.js search, filtering, sorting, and helper functions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createSearchInstance,
  searchCatalog,
  sortResults,
  getUniqueTools,
  getUniqueCategories,
  getUniqueLicenses,
  type SearchIndexEntry,
  type SearchFilters,
} from "../lib/search";

describe("Search utilities", () => {
  let mockEntries: SearchIndexEntry[];

  beforeEach(() => {
    mockEntries = [
      {
        id: "packs/base/base-global",
        name: "Base Global",
        slug: "base-global",
        description: "Essential rules for all projects",
        summary_bullets: ["Code quality", "Security", "Best practices"],
        categories: ["code-quality", "security"],
        tags: ["essential", "baseline"],
        compatible_tools: ["cursor", "claude-code"],
        license: "MIT",
        last_updated: "2025-10-31T10:00:00Z",
        has_plugs: false,
        overlay_friendly: true,
        stats: { copies_7d: 50 },
      },
      {
        id: "packs/stacks/nextjs",
        name: "Next.js Stack",
        slug: "nextjs-stack",
        description: "Rules for Next.js applications with TypeScript",
        summary_bullets: ["App Router", "Server Components", "API routes"],
        categories: ["frameworks", "web"],
        tags: ["nextjs", "react", "typescript"],
        compatible_tools: ["cursor", "warp"],
        license: "MIT",
        last_updated: "2025-10-30T15:00:00Z",
        has_plugs: true,
        overlay_friendly: false,
        stats: { copies_7d: 25 },
      },
      {
        id: "packs/security/owasp",
        name: "OWASP Security",
        slug: "owasp-security",
        description: "Security rules based on OWASP Top 10",
        summary_bullets: ["Injection prevention", "XSS protection", "Auth"],
        categories: ["security", "compliance"],
        tags: ["owasp", "security", "audit"],
        compatible_tools: ["cursor", "claude-code", "warp"],
        license: "Apache-2.0",
        last_updated: "2025-10-29T08:00:00Z",
        has_plugs: true,
        overlay_friendly: true,
        stats: { copies_7d: 10 },
      },
    ];
  });

  describe("createSearchInstance", () => {
    it("should create Fuse instance with entries", () => {
      const fuse = createSearchInstance(mockEntries);
      expect(fuse).toBeDefined();
      expect(fuse.getIndex().docs).toHaveLength(3);
    });

    it("should handle empty entries", () => {
      const fuse = createSearchInstance([]);
      expect(fuse).toBeDefined();
      expect(fuse.getIndex().docs).toHaveLength(0);
    });
  });

  describe("searchCatalog", () => {
    it("should return all entries when query is empty", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "");
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.score === 0)).toBe(true);
    });

    it("should search by name", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "Next.js");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.name).toBe("Next.js Stack");
    });

    it("should search by description", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "security rules");
      expect(results.length).toBeGreaterThan(0);
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/security/owasp");
    });

    it("should search by tags", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "typescript");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.id).toBe("packs/stacks/nextjs");
    });

    it("should return empty array when no matches", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "nonexistent-xyz-123");
      expect(results).toHaveLength(0);
    });
  });

  describe("searchCatalog with filters", () => {
    it("should filter by single tool (AND logic)", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { tools: ["cursor"] };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(3); // All have cursor
    });

    it("should filter by multiple tools (AND logic)", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { tools: ["cursor", "warp"] };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(2); // nextjs and owasp
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/stacks/nextjs");
      expect(ids).toContain("packs/security/owasp");
    });

    it("should filter by category (OR logic)", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { categories: ["security"] };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(2); // base-global and owasp
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/base/base-global");
      expect(ids).toContain("packs/security/owasp");
    });

    it("should filter by license", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { license: "Apache-2.0" };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(1);
      expect(results[0].item.id).toBe("packs/security/owasp");
    });

    it("should filter by has_plugs", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { hasPlugs: true };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/stacks/nextjs");
      expect(ids).toContain("packs/security/owasp");
    });

    it("should filter by overlay_friendly", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = { overlayFriendly: true };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(2);
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/base/base-global");
      expect(ids).toContain("packs/security/owasp");
    });

    it("should filter by last_updated_after", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = {
        lastUpdatedAfter: "2025-10-30T00:00:00Z",
      };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(2); // base-global and nextjs
      const ids = results.map((r) => r.item.id);
      expect(ids).toContain("packs/base/base-global");
      expect(ids).toContain("packs/stacks/nextjs");
    });

    it("should combine multiple filters", () => {
      const fuse = createSearchInstance(mockEntries);
      const filters: SearchFilters = {
        tools: ["cursor"],
        categories: ["security"],
        hasPlugs: true,
      };
      const results = searchCatalog(fuse, "", filters);
      expect(results).toHaveLength(1);
      expect(results[0].item.id).toBe("packs/security/owasp");
    });
  });

  describe("sortResults", () => {
    it("should sort by most-copied-7d", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "");
      const sorted = sortResults(results, "most-copied-7d");
      expect(sorted[0].item.id).toBe("packs/base/base-global"); // 50 copies
      expect(sorted[1].item.id).toBe("packs/stacks/nextjs"); // 25 copies
      expect(sorted[2].item.id).toBe("packs/security/owasp"); // 10 copies
    });

    it("should sort by recently-updated", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "");
      const sorted = sortResults(results, "recently-updated");
      expect(sorted[0].item.id).toBe("packs/base/base-global"); // 2025-10-31
      expect(sorted[1].item.id).toBe("packs/stacks/nextjs"); // 2025-10-30
      expect(sorted[2].item.id).toBe("packs/security/owasp"); // 2025-10-29
    });

    it("should sort by name-asc", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "");
      const sorted = sortResults(results, "name-asc");
      expect(sorted[0].item.name).toBe("Base Global");
      expect(sorted[1].item.name).toBe("Next.js Stack");
      expect(sorted[2].item.name).toBe("OWASP Security");
    });

    it("should sort by trending (weighted)", () => {
      const fuse = createSearchInstance(mockEntries);
      const results = searchCatalog(fuse, "");
      const sorted = sortResults(results, "trending");
      // Trending = 0.7 * copies_7d + 0.3 * (1 - score)
      // base-global: 0.7 * 50 + 0.3 * 1 = 35.3
      // nextjs: 0.7 * 25 + 0.3 * 1 = 17.8
      // owasp: 0.7 * 10 + 0.3 * 1 = 7.3
      expect(sorted[0].item.id).toBe("packs/base/base-global");
      expect(sorted[1].item.id).toBe("packs/stacks/nextjs");
      expect(sorted[2].item.id).toBe("packs/security/owasp");
    });
  });

  describe("getUniqueTools", () => {
    it("should extract unique tools", () => {
      const tools = getUniqueTools(mockEntries);
      expect(tools).toEqual(["claude-code", "cursor", "warp"]);
    });

    it("should handle empty entries", () => {
      const tools = getUniqueTools([]);
      expect(tools).toEqual([]);
    });
  });

  describe("getUniqueCategories", () => {
    it("should extract unique categories", () => {
      const categories = getUniqueCategories(mockEntries);
      expect(categories).toEqual([
        "code-quality",
        "compliance",
        "frameworks",
        "security",
        "web",
      ]);
    });

    it("should handle empty entries", () => {
      const categories = getUniqueCategories([]);
      expect(categories).toEqual([]);
    });
  });

  describe("getUniqueLicenses", () => {
    it("should extract unique licenses", () => {
      const licenses = getUniqueLicenses(mockEntries);
      expect(licenses).toEqual(["Apache-2.0", "MIT"]);
    });

    it("should handle empty entries", () => {
      const licenses = getUniqueLicenses([]);
      expect(licenses).toEqual([]);
    });
  });
});
