/**
 * Common test utilities for the catalog website.
 */
import type { CatalogEntryExtended } from "@aligntrue/schema";

/**
 * Creates a complete, valid CatalogEntryExtended object for testing.
 * This ensures all required fields are present with sensible defaults,
 * preventing fixture-related test failures.
 *
 * @param overrides - Partial pack data to override the defaults.
 * @returns A complete CatalogEntryExtended object.
 */
export function createTestPack(
  overrides: Partial<CatalogEntryExtended> = {},
): CatalogEntryExtended {
  // Base structure with all required fields.
  const basePack: Omit<CatalogEntryExtended, "id" | "slug" | "name"> = {
    version: "1.0.0",
    description: "A test pack for unit tests",
    summary_bullets: ["Feature 1", "Feature 2"],
    categories: ["testing", "development"],
    tags: ["test", "mock"],
    compatible_tools: ["cursor", "claude-code"],
    license: "CC0-1.0",
    maintainer: { name: "AlignTrue Test", github: "aligntrue" },
    last_updated: "2025-10-31",
    source_linked: false,
    overlay_friendly: false,
    stats: { copies_7d: 100 },
    plugs: [], // Default to no plugs
    exporters: [
      {
        format: "yaml",
        preview: 'spec_version: "1"\\n# Default YAML preview',
        preview_meta: {
          engine_version: "0.1.0",
          canonical_yaml_sha: "abc123xyz",
          rendered_at: "2025-10-31T00:00:00Z",
        },
      },
    ],
  };

  const finalPack = {
    ...basePack,
    id: overrides.id ?? "test/pack",
    slug: overrides.slug ?? "test-pack",
    name: overrides.name ?? "Test Pack",
    ...overrides,
  } as CatalogEntryExtended;

  // Derive required_plugs from plugs
  finalPack.required_plugs = finalPack.plugs?.filter((p: any) => p.required);
  finalPack.has_plugs = (finalPack.plugs?.length || 0) > 0;
  finalPack.required_plugs_count = finalPack.required_plugs?.length || 0;

  return finalPack;
}
