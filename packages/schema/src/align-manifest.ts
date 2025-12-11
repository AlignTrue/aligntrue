/**
 * Align Manifest Types
 *
 * TypeScript types for .align.yaml manifest files that define curated bundles
 * of rules and configurations for sharing.
 */

/**
 * Customization settings for a specific file within an align
 */
export interface AlignCustomization {
  /** Pre-filled plug values for this file */
  plugs?: Record<string, string>;
  /** Frontmatter overrides for this file */
  frontmatter?: {
    /** Override glob patterns for when rule applies */
    globs?: string[];
    /** Whether this rule is enabled by default */
    enabled?: boolean;
    /** Additional frontmatter properties */
    [key: string]: unknown;
  };
}

/**
 * Content includes specification
 */
export interface AlignIncludes {
  /** Relative paths to rule .md files to include */
  rules?: string[];
  /** Relative paths to skill .md files to include */
  skills?: string[];
  /** Relative paths to MCP configuration files */
  mcp?: string[];
}

/**
 * Default settings for consumers
 */
export interface AlignDefaults {
  /** Default exporters to enable (e.g., ['cursor', 'agents']) */
  exporters?: string[];
  /** Default mode for new users */
  mode?: "solo" | "team";
}

/**
 * Align Manifest - defines a curated bundle of rules and configurations
 *
 * Used in .align.yaml files to share complete align packages with
 * author-recommended customizations that consumers can override.
 */
export interface AlignManifest {
  /** Unique identifier in author/name format (e.g., 'aligntrue/typescript-starter') */
  id: string;
  /** Semantic version (MAJOR.MINOR.PATCH) */
  version: string;
  /** One-line description for sharing and discovery */
  summary?: string;
  /** Longer description for catalog display */
  description?: string;
  /** Author identifier (e.g., '@username' or 'Organization Name') */
  author?: string;
  /** SPDX license identifier (e.g., 'MIT', 'CC0-1.0') */
  license?: string;
  /** URL to documentation or homepage */
  homepage?: string;
  /** URL to source repository */
  repository?: string;
  /** Content to include in this align */
  includes?: AlignIncludes;
  /** Author-recommended customizations keyed by relative file path */
  customizations?: Record<string, AlignCustomization>;
  /** Default settings for consumers */
  defaults?: AlignDefaults;
  /** Categorization tags for discovery */
  tags?: string[];
  /** List of compatible AI agents (e.g., ['cursor', 'claude', 'github-copilot']) */
  compatible_agents?: string[];
}

/**
 * Validate an align manifest ID format
 */
export function isValidManifestId(id: string): boolean {
  return /^[a-z0-9-]+\/[a-z0-9-]+$/.test(id);
}

/**
 * Parse an align manifest ID into author and name components
 */
export function parseManifestId(
  id: string,
): { author: string; name: string } | null {
  const match = id.match(/^([a-z0-9-]+)\/([a-z0-9-]+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { author: match[1], name: match[2] };
}
