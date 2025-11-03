/**
 * Catalog entry data model (Phase 4)
 *
 * Extended catalog entry interface for public catalog website.
 * Includes discovery metadata, trust signals, customization hints,
 * and pre-computed exporter previews with provenance.
 */

/**
 * Provenance metadata for exporter previews
 */
export interface PreviewMeta {
  /** AlignTrue engine version that generated this preview */
  engine_version: string;
  /** SHA-256 hash of canonical YAML source */
  canonical_yaml_sha: string;
  /** ISO 8601 timestamp when preview was rendered */
  rendered_at: string;
}

/**
 * Rule index entry for overlay-friendly packs
 */
export interface RuleIndexEntry {
  /** Stable rule ID */
  id: string;
  /** Optional path within pack (for nested rules) */
  path?: string;
  /** SHA-256 hash of rule content */
  content_sha: string;
}

/**
 * Required plug definition for copy block generation
 */
export interface RequiredPlug {
  /** Plug key (e.g., "test.cmd") */
  key: string;
  /** Human-readable description */
  description: string;
  /** Plug type (string, number, boolean, etc.) */
  type: string;
  /** Optional default value */
  default?: string;
}

/**
 * Exporter preview with provenance
 */
export interface ExporterPreview {
  /** Format identifier (yaml, agents-md, cursor, warp, vscode-mcp, json-markers) */
  format: string;
  /** Preview content (text) */
  preview: string;
  /** Provenance metadata */
  preview_meta: PreviewMeta;
}

/**
 * Maintainer information
 */
export interface Maintainer {
  /** Maintainer name */
  name: string;
  /** GitHub username (optional) */
  github?: string;
  /** Email (optional) */
  email?: string;
}

/**
 * Attribution information for community-contributed packs
 */
export interface Attribution {
  /** Type: original (AlignTrue) or community (third-party) */
  type: "original" | "community";
  /** Original author name or handle */
  author: string;
  /** Link to original source (tweet, gist, repo, etc.) */
  source_url: string;
}

/**
 * Usage statistics
 */
export interface PackStats {
  /** Copies in last 7 days (tracked via --from=catalog_web) */
  copies_7d: number;
  /** Total all-time copies (optional, Phase 4.6) */
  copies_total?: number;
}

/**
 * Base catalog entry (compatibility with existing catalog provider)
 */
export interface CatalogEntryBase {
  /** Pack ID (e.g., "packs/base/base-global") */
  id: string;
  /** Semantic version */
  version: string;
  /** Profile metadata (legacy, optional) */
  profile?: {
    id?: string;
    url?: string;
  };
  /** Short summary (1 sentence) */
  summary?: string;
  /** Tags for discovery */
  tags?: string[];
  /** Content SHA-256 hash */
  content_sha256?: string;
}

/**
 * Extended catalog entry for Phase 4 website
 *
 * Extends base entry with discovery metadata, trust signals,
 * customization hints, and pre-computed previews.
 */
export interface CatalogEntryExtended extends CatalogEntryBase {
  // Display
  /** Human-readable name */
  name: string;
  /** URL-friendly slug */
  slug: string;
  /** Full description (2-3 sentences) */
  description: string;
  /** Author-provided summary bullets (3-5 items) */
  summary_bullets: string[];

  // Discovery
  /** Categories for filtering (e.g., "code-quality", "security") */
  categories: string[];
  /** Compatible tools/agents (e.g., "cursor", "claude-code") */
  compatible_tools: string[];
  /** License identifier (SPDX) */
  license: string;

  // Author
  /** Maintainer information */
  maintainer: Maintainer;
  /** Optional attribution for community-contributed packs */
  attribution?: Attribution;

  // Trust signals
  /** ISO 8601 timestamp of last update */
  last_updated: string;
  /** ISO 8601 timestamp of initial publication (optional) */
  published_at?: string;
  /** Source repository URL (GitHub/GitLab) */
  source_repo?: string;
  /** Reserved namespace owner (GitHub org/user) */
  namespace_owner?: string;
  /** Source linked status (computed at build time) */
  source_linked?: boolean;
  /** Trust score (0-100) based on GitHub stars, maintainer reputation, freshness */
  trust_score?: number;

  // Usage stats
  /** Usage statistics */
  stats: PackStats;

  // Customization
  /** Has configurable plugs */
  has_plugs: boolean;
  /** Overlay-friendly (has rules_index) */
  overlay_friendly: boolean;
  /** Count of required plugs */
  required_plugs_count: number;
  /** Required plugs for copy block generation */
  required_plugs?: RequiredPlug[];
  /** Rule index for overlay-friendly packs */
  rules_index?: RuleIndexEntry[];
  /** Complexity score (0-100) based on rule count, nesting depth, description length */
  complexity_score?: number;

  // Pre-computed exports with provenance
  /** Exporter previews */
  exporters: ExporterPreview[];
}

/**
 * Extended catalog index structure
 */
export interface CatalogIndexExtended {
  /** Index format version */
  version: string;
  /** Generation timestamp */
  generated_at: string;
  /** AlignTrue engine version used for generation */
  engine_version: string;
  /** Extended pack entries */
  packs: CatalogEntryExtended[];
}

/**
 * Validation result for catalog entry
 */
export interface CatalogEntryValidation {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate catalog entry structure
 *
 * @param entry - Catalog entry to validate
 * @returns Validation result
 */
export function validateCatalogEntry(entry: unknown): CatalogEntryValidation {
  const errors: string[] = [];

  if (typeof entry !== "object" || entry === null) {
    return { valid: false, errors: ["Entry must be an object"] };
  }

  const e = entry as Record<string, unknown>;

  // Required fields
  const requiredFields = [
    "id",
    "version",
    "name",
    "slug",
    "description",
    "summary_bullets",
    "categories",
    "tags",
    "compatible_tools",
    "license",
    "maintainer",
    "last_updated",
    "stats",
    "has_plugs",
    "overlay_friendly",
    "required_plugs_count",
    "exporters",
  ];

  for (const field of requiredFields) {
    if (!(field in e)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type validations
  if (e["id"] && typeof e["id"] !== "string") {
    errors.push("id must be a string");
  }
  if (e["version"] && typeof e["version"] !== "string") {
    errors.push("version must be a string");
  }
  if (e["name"] && typeof e["name"] !== "string") {
    errors.push("name must be a string");
  }
  if (e["slug"] && typeof e["slug"] !== "string") {
    errors.push("slug must be a string");
  }
  if (e["description"] && typeof e["description"] !== "string") {
    errors.push("description must be a string");
  }
  if (e["summary_bullets"] && !Array.isArray(e["summary_bullets"])) {
    errors.push("summary_bullets must be an array");
  }
  if (e["categories"] && !Array.isArray(e["categories"])) {
    errors.push("categories must be an array");
  }
  if (e["tags"] && !Array.isArray(e["tags"])) {
    errors.push("tags must be an array");
  }
  if (e["compatible_tools"] && !Array.isArray(e["compatible_tools"])) {
    errors.push("compatible_tools must be an array");
  }
  if (e["license"] && typeof e["license"] !== "string") {
    errors.push("license must be a string");
  }
  if (e["has_plugs"] && typeof e["has_plugs"] !== "boolean") {
    errors.push("has_plugs must be a boolean");
  }
  if (e["overlay_friendly"] && typeof e["overlay_friendly"] !== "boolean") {
    errors.push("overlay_friendly must be a boolean");
  }
  if (
    e["required_plugs_count"] &&
    typeof e["required_plugs_count"] !== "number"
  ) {
    errors.push("required_plugs_count must be a number");
  }
  if (e["exporters"] && !Array.isArray(e["exporters"])) {
    errors.push("exporters must be an array");
  }

  // Validate maintainer structure
  if (e["maintainer"]) {
    const m = e["maintainer"] as Record<string, unknown>;
    if (!m["name"] || typeof m["name"] !== "string") {
      errors.push("maintainer.name is required and must be a string");
    }
  }

  // Validate attribution structure (optional)
  if (e["attribution"]) {
    const a = e["attribution"] as Record<string, unknown>;
    if (!a["type"] || (a["type"] !== "original" && a["type"] !== "community")) {
      errors.push('attribution.type must be "original" or "community"');
    }
    if (!a["author"] || typeof a["author"] !== "string") {
      errors.push("attribution.author is required and must be a string");
    }
    if (!a["source_url"] || typeof a["source_url"] !== "string") {
      errors.push("attribution.source_url is required and must be a string");
    }
  }

  // Validate stats structure
  if (e["stats"]) {
    const s = e["stats"] as Record<string, unknown>;
    if (
      s["copies_7d"] === undefined ||
      typeof s["copies_7d"] !== "number" ||
      s["copies_7d"] < 0
    ) {
      errors.push("stats.copies_7d must be a non-negative number");
    }
  }

  // Validate exporters structure
  if (Array.isArray(e["exporters"])) {
    (e["exporters"] as unknown[]).forEach((exp, idx) => {
      if (typeof exp !== "object" || exp === null) {
        errors.push(`exporters[${idx}] must be an object`);
        return;
      }
      const ex = exp as Record<string, unknown>;
      if (!ex["format"] || typeof ex["format"] !== "string") {
        errors.push(
          `exporters[${idx}].format is required and must be a string`,
        );
      }
      if (!ex["preview"] || typeof ex["preview"] !== "string") {
        errors.push(
          `exporters[${idx}].preview is required and must be a string`,
        );
      }
      if (!ex["preview_meta"] || typeof ex["preview_meta"] !== "object") {
        errors.push(
          `exporters[${idx}].preview_meta is required and must be an object`,
        );
      } else {
        const meta = ex["preview_meta"] as Record<string, unknown>;
        if (
          !meta["engine_version"] ||
          typeof meta["engine_version"] !== "string"
        ) {
          errors.push(
            `exporters[${idx}].preview_meta.engine_version is required`,
          );
        }
        if (
          !meta["canonical_yaml_sha"] ||
          typeof meta["canonical_yaml_sha"] !== "string"
        ) {
          errors.push(
            `exporters[${idx}].preview_meta.canonical_yaml_sha is required`,
          );
        }
        if (!meta["rendered_at"] || typeof meta["rendered_at"] !== "string") {
          errors.push(`exporters[${idx}].preview_meta.rendered_at is required`);
        }
      }
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate catalog index structure
 *
 * @param index - Catalog index to validate
 * @returns Validation result
 */
export function validateCatalogIndex(index: unknown): CatalogEntryValidation {
  const errors: string[] = [];

  if (typeof index !== "object" || index === null) {
    return { valid: false, errors: ["Index must be an object"] };
  }

  const i = index as Record<string, unknown>;

  // Required fields
  if (!i["version"] || typeof i["version"] !== "string") {
    errors.push("version is required and must be a string");
  }
  if (!i["generated_at"] || typeof i["generated_at"] !== "string") {
    errors.push("generated_at is required and must be a string");
  }
  if (!i["engine_version"] || typeof i["engine_version"] !== "string") {
    errors.push("engine_version is required and must be a string");
  }
  if (!i["packs"] || !Array.isArray(i["packs"])) {
    errors.push("packs is required and must be an array");
  }

  // Validate each pack entry
  if (Array.isArray(i["packs"])) {
    (i["packs"] as unknown[]).forEach((pack, idx) => {
      const result = validateCatalogEntry(pack);
      if (!result.valid && result.errors) {
        result.errors.forEach((err) => {
          errors.push(`packs[${idx}]: ${err}`);
        });
      }
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return {
    valid: true,
  };
}
