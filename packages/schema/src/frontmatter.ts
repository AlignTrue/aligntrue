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

  // Selection (Where rule applies)
  /** Hierarchical scope path (relative to repo root) */
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
  /**
   * @deprecated Use `gitignore` instead. Will be removed in next major version.
   */
  private?: boolean;

  // Tracking Metadata (Auto-managed)
  /**
   * Source URL/path where this rule was imported from
   * @deprecated Removed in favor of audit log (.aligntrue/.history)
   */
  original_source?: string;
  /**
   * Source URL/path where this rule was imported from
   * @deprecated Removed in favor of audit log (.aligntrue/.history).
   * Import events are now logged to .aligntrue/.history instead of frontmatter.
   */
  source?: string;
  /**
   * Date when this rule was added (ISO format: YYYY-MM-DD)
   * @deprecated Removed in favor of audit log (.aligntrue/.history).
   * Import timestamps are now logged to .aligntrue/.history instead of frontmatter.
   */
  source_added?: string;
  /**
   * Original path of the rule file
   * @deprecated Removed in favor of audit log (.aligntrue/.history).
   * Original paths are now logged to .aligntrue/.history instead of frontmatter.
   */
  original_path?: string;
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
    private: { type: "boolean" }, // Deprecated, use gitignore
    cursor: { type: "object" },
    agents: { type: "object" },
    original_source: { type: "string" },
    source: { type: "string" },
    source_added: { type: "string" },
    original_path: { type: "string" },
    content_hash: { type: "string" },
    nested_location: { type: "string" },
  },
  additionalProperties: true,
};
