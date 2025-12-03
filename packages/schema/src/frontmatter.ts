/**
 * Comprehensive Frontmatter Schema for Rule Files (.aligntrue/rules/*.md)
 */

/**
 * Cursor-specific metadata
 */
export interface CursorMetadata {
  /** Activation model (alwaysOn, manual, etc) */
  when?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Additional Cursor-specific fields */
  [key: string]: unknown;
}

/**
 * Agent-specific metadata (generic)
 */
export interface AgentMetadata {
  /** Priority level (high, medium, low) */
  priority?: "high" | "medium" | "low";
  /** Additional agent-specific fields */
  [key: string]: unknown;
}

/**
 * AlignTrue Rule Frontmatter
 * Superset of all supported metadata
 */
export interface RuleFrontmatter {
  /** Rule title */
  title?: string;
  /** Brief description */
  description?: string;

  // Enable/disable
  /** Whether this rule is enabled (default: true) */
  enabled?: boolean;

  // Scope
  /**
   * Rule scope - can be used for:
   * - Approval/routing: "team" | "personal" | "shared" (controls lockfile inclusion and remote routing)
   * - Path-based: any string path for monorepo scoping
   */
  scope?: string;
  /** Glob patterns (additive with scope) */
  globs?: string[];
  /** Activation hint (e.g. alwaysOn) - maps to agent equivalents */
  apply_to?: string;

  // Export Controls
  /** Formats to EXCLUDE this rule from */
  exclude_from?: string[];
  /** Formats to ONLY export this rule to */
  export_only_to?: string[];

  // Agent-Specific Blocks
  cursor?: CursorMetadata;
  agents?: AgentMetadata;
  // Allow other agent blocks (claude, windsurf, etc)
  [key: string]: unknown;

  // Privacy Controls
  /**
   * Mark rule as gitignored (not committed to git)
   * When true, both source file and exported versions are auto-gitignored
   * Overrides source-level `gitignore` setting
   */
  gitignore?: boolean;

  // Tracking Metadata (Auto-managed)
  /** Content hash for drift detection */
  content_hash?: string;
  /** Nested directory location (if applicable) */
  nested_location?: string;
}

/**
 * Represents a parsed rule file (Canonical IR Unit)
 */
export interface RuleFile {
  /**
   * The rule content (body)
   */
  content: string;

  /**
   * Frontmatter metadata
   */
  frontmatter: RuleFrontmatter;

  /**
   * File path relative to workspace root
   */
  path: string;

  /**
   * Filename (e.g. "testing.md")
   */
  filename: string;

  /**
   * Path relative to .aligntrue/rules/ directory (preserves nested structure)
   * e.g. "very/deep/rule.md" for .aligntrue/rules/very/deep/rule.md
   * For flat files in .aligntrue/rules/, same as filename
   */
  relativePath?: string;

  /**
   * Computed hash of content + frontmatter
   */
  hash: string;
}

/**
 * Validation schema for RuleFrontmatter (JSON Schema)
 */
export const frontmatterSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    enabled: { type: "boolean" },
    scope: { type: "string" },
    globs: { type: "array", items: { type: "string" } },
    apply_to: { type: "string" },
    exclude_from: { type: "array", items: { type: "string" } },
    export_only_to: { type: "array", items: { type: "string" } },
    gitignore: { type: "boolean" },
    cursor: { type: "object" },
    agents: { type: "object" },
    content_hash: { type: "string" },
    nested_location: { type: "string" },
  },
  additionalProperties: true,
};
