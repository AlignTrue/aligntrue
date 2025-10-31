/**
 * Common test utilities for the catalog website.
 */
import type { CatalogEntryExtended, RequiredPlug } from "@aligntrue/schema";

/**
 * Helper type to allow passing plugs array for convenience in tests.
 * This gets converted to the proper required_plugs format.
 */
type TestPackOverrides = Partial<CatalogEntryExtended> & {
  plugs?: Array<{
    key: string;
    description: string;
    type: string;
    default?: string;
    required?: boolean;
  }>;
};

/**
 * Creates a complete, valid CatalogEntryExtended object for testing.
 * This ensures all required fields are present with sensible defaults,
 * preventing fixture-related test failures.
 *
 * @param overrides - Partial pack data to override the defaults.
 * @returns A complete CatalogEntryExtended object.
 */
export function createTestPack(
  overrides: TestPackOverrides = {},
): CatalogEntryExtended {
  // Extract plugs array if provided (for convenience in tests)
  const { plugs, ...rest } = overrides;

  // Convert plugs to required_plugs format
  const required_plugs: RequiredPlug[] | undefined = plugs?.map((p) => ({
    key: p.key,
    description: p.description,
    type: p.type,
    default: p.default,
  }));

  // Base structure with default values for required fields.
  const basePack: Partial<CatalogEntryExtended> = {
    version: "1.0.0",
    description: "A test pack for unit tests",
    summary_bullets: ["Feature 1", "Feature 2"],
    categories: ["testing", "development"],
    tags: ["test", "mock"],
    compatible_tools: ["cursor", "claude-code"],
    license: "CC0-1.0",
    maintainer: { name: "AlignTrue Test", github: "aligntrue" },
    last_updated: "2025-10-31",
    published_at: "2025-10-01",
    source_linked: false,
    overlay_friendly: false,
    stats: { copies_7d: 100 },
    has_plugs: !!required_plugs && required_plugs.length > 0,
    required_plugs_count: required_plugs?.length || 0,
    required_plugs,
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
    id: rest.id ?? "test/pack",
    slug: rest.slug ?? "test-pack",
    name: rest.name ?? "Test Pack",
    ...rest,
    // Ensure computed fields are set correctly after merge
    has_plugs:
      rest.has_plugs ?? (!!required_plugs && required_plugs.length > 0),
    required_plugs_count:
      rest.required_plugs_count ?? (required_plugs?.length || 0),
    required_plugs: rest.required_plugs ?? required_plugs,
  } as CatalogEntryExtended;

  return finalPack;
}
