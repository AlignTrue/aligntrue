/**
 * Generic Markdown Exporter
 * Base class for all link-based exporters (CLAUDE.md, WARP.md, etc.)
 *
 * Creates files with links to .aligntrue/rules/*.md instead of concatenated content.
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "@aligntrue/plugin-contracts";
import type { RuleFile, RuleFrontmatter } from "@aligntrue/schema";
import { join } from "path";
import { ExporterBase } from "./index.js";
import { getContentMode } from "../utils/config-access.js";

/**
 * Generic configurable markdown exporter with link-based output
 * Used as delegate for agent-specific exporters
 */
export class GenericMarkdownExporter extends ExporterBase {
  name: string;
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: false, // Single-file format
    scopeAware: true, // Can filter by scope
    preserveStructure: false, // Link-based
    nestedDirectories: true, // Supports nested scope directories
  };

  private filename: string; // e.g., "CLAUDE.md", "WARP.md"
  private title: string; // e.g., "CLAUDE.md", "WARP.md"
  private description: string; // e.g., "for Claude Code", "for Warp"

  constructor(
    name: string,
    filename: string,
    title: string,
    description: string,
  ) {
    super();
    this.name = name;
    this.filename = filename;
    this.title = title;
    this.description = description;
  }

  override async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with align)
    const rules = this.getRulesFromRequest(request);

    // Filter rules that should be exported to this agent
    const exportableRules = rules.filter((rule) =>
      this.shouldExportRule(rule, this.name),
    );

    if (exportableRules.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Group rules by nested location
    const rulesByLocation = this.groupRulesByLocation(exportableRules);

    const allFilesWritten: string[] = [];
    const contentHashes: string[] = [];
    const warnings: string[] = [];

    // Determine content mode from CLI option or config
    const contentMode = getContentMode(
      options.config,
      options.contentMode as string | undefined,
    );

    for (const [location, locationRules] of rulesByLocation.entries()) {
      // Determine output path
      const outputPath =
        location === ""
          ? join(outputDir, this.filename)
          : join(outputDir, location, this.filename);

      // Determine which mode to use (for auto mode, decide based on rule count)
      const effectiveMode =
        contentMode === "auto"
          ? locationRules.length === 1
            ? "inline"
            : "links"
          : contentMode;

      // Generate content based on mode
      const { content, warning } =
        effectiveMode === "inline"
          ? this.generateInlineContent(locationRules, location)
          : {
              content: this.generateLinkBasedContent(
                locationRules,
                location,
                outputDir,
              ),
              warning: undefined,
            };

      if (warning) {
        warnings.push(warning);
      }

      // Always compute content hash (for dry-run to return meaningful hash)
      contentHashes.push(this.computeHash(content));

      // Write file
      const files = await this.writeFile(outputPath, content, dryRun, {
        ...options,
        force: true, // Always force overwrite for read-only exports
      });

      if (files.length > 0) {
        allFilesWritten.push(...files);
      }
    }

    const combinedHash =
      contentHashes.length > 0
        ? this.computeHash(contentHashes.sort().join(""))
        : "";

    return this.buildResult(allFilesWritten, combinedHash, warnings);
  }

  override translateFrontmatter(
    frontmatter: RuleFrontmatter,
  ): Record<string, unknown> {
    // Minimal frontmatter - just title and description
    const result: Record<string, unknown> = {};

    if (frontmatter["title"]) {
      result["title"] = frontmatter["title"];
    }

    if (frontmatter["description"]) {
      result["description"] = frontmatter["description"];
    }

    return result;
  }

  resetState(): void {
    // No state to reset
  }

  /**
   * Format conditions from frontmatter into human-readable text
   * Handles any frontmatter values without hardcoded mappings
   */
  private formatConditions(frontmatter: RuleFrontmatter): string {
    const parts: string[] = [];

    // Always/activation - show actual value
    const when = frontmatter.cursor?.when || frontmatter.apply_to;
    if (when === "alwaysOn") {
      parts.push("Always applied.");
    } else if (when) {
      parts.push(`Apply when: ${when}.`);
    }

    // Globs - just show the actual glob patterns
    // Handle both array and string formats (YAML may parse as either)
    if (frontmatter.globs) {
      const rawGlobs = frontmatter.globs as string | string[];
      const globs: string[] = Array.isArray(rawGlobs)
        ? rawGlobs
        : (rawGlobs as string)
            .split(/[,\s]+/)
            .map((g: string) => g.trim())
            .filter(Boolean);
      if (globs.length > 0) {
        const globList = globs.map((g: string) => `\`${g}\``).join(", ");
        parts.push(`For files: ${globList}.`);
      }
    }

    // Scope - just show the path
    if (
      frontmatter.scope &&
      frontmatter.scope !== "." &&
      frontmatter.scope !== "General"
    ) {
      parts.push(`Scope: \`${frontmatter.scope}\`.`);
    }

    return parts.join(" ");
  }

  /**
   * Group rules by their nested_location
   */
  private groupRulesByLocation(rules: RuleFile[]): Map<string, RuleFile[]> {
    const byLocation = new Map<string, RuleFile[]>();

    for (const rule of rules) {
      const location = rule.frontmatter.nested_location || "";
      if (!byLocation.has(location)) {
        byLocation.set(location, []);
      }
      byLocation.get(location)!.push(rule);
    }

    return byLocation;
  }

  /**
   * Generate link-based content for the markdown file
   */
  private generateLinkBasedContent(
    rules: RuleFile[],
    location: string,
    _outputDir: string,
  ): string {
    const lines: string[] = [];

    // Read-only marker
    lines.push(this.renderReadOnlyMarker("").trim());
    lines.push("");

    // Header
    lines.push(`# ${this.title}`);
    lines.push("");
    lines.push(
      "This file contains links to the canonical rules in \`.aligntrue/rules/\`.",
    );
    lines.push("AI agents should follow these linked guidelines.");
    lines.push("");
    lines.push(
      "How to switch from links to inline rules: https://aligntrue.ai/export-content-mode",
    );
    lines.push("");

    // Group rules by category
    const rulesByCategory = this.groupRulesByCategory(rules);

    for (const [category, categoryRules] of rulesByCategory.entries()) {
      lines.push(`## ${category}`);
      lines.push("");

      for (const rule of categoryRules) {
        const title =
          rule.frontmatter.title || rule.filename.replace(/\.md$/, "");
        const description = rule.frontmatter.description || "";
        const conditions = this.formatConditions(rule.frontmatter);

        // Compute relative path from file to the rule file
        const rulesDir =
          location === "" ? ".aligntrue/rules" : `${location}/.aligntrue/rules`;
        // Use relativePath if available (preserves nested structure), fallback to filename
        // Normalize backslashes to forward slashes for cross-platform compatibility
        const ruleFileName = (rule.relativePath || rule.filename).replace(
          /\\/g,
          "/",
        );
        const linkPath = `./${rulesDir}/${ruleFileName}`;

        // Format: Title (path): description. conditions.
        if (description && conditions) {
          lines.push(`- ${title} (${linkPath}): ${description}. ${conditions}`);
        } else if (description) {
          lines.push(`- ${title} (${linkPath}): ${description}`);
        } else if (conditions) {
          lines.push(`- ${title} (${linkPath}): ${conditions}`);
        } else {
          lines.push(`- ${title} (${linkPath})`);
        }
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Group rules by category for organized output
   */
  private groupRulesByCategory(rules: RuleFile[]): Map<string, RuleFile[]> {
    const byCategory = new Map<string, RuleFile[]>();

    for (const rule of rules) {
      const category = rule.frontmatter.scope || "General";
      const displayCategory = this.formatCategoryName(category);

      if (!byCategory.has(displayCategory)) {
        byCategory.set(displayCategory, []);
      }
      byCategory.get(displayCategory)!.push(rule);
    }

    // Ensure "General" is first if it exists
    const sorted = new Map<string, RuleFile[]>();
    if (byCategory.has("General")) {
      sorted.set("General", byCategory.get("General")!);
    }
    for (const [cat, r] of byCategory) {
      if (cat !== "General") {
        sorted.set(cat, r);
      }
    }

    return sorted;
  }

  /**
   * Format category name for display
   */
  private formatCategoryName(scope: string): string {
    if (scope === "." || scope === "" || scope === "General") {
      return "General";
    }

    return scope
      .split("/")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" / ");
  }

  /**
   * Generate inline content for single or multiple rules
   * Each rule is embedded with full content, separated by HTML comments
   * Emits warning if combined content exceeds 50KB
   */
  private generateInlineContent(
    rules: RuleFile[],
    _location: string,
  ): { content: string; warning?: string } {
    const lines: string[] = [];

    // Read-only marker
    lines.push(this.renderReadOnlyMarker("").trim());
    lines.push("");

    // Header
    lines.push(`# ${this.title}`);
    lines.push("");
    lines.push(
      `This file contains the canonical rules from \`.aligntrue/rules/\`.`,
    );
    lines.push("");

    // Add each rule with separator
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule) continue; // Skip undefined rules

      if (i > 0) {
        lines.push("");
      }

      // Add rule separator comment with source file
      lines.push(`<!-- aligntrue:rule ${rule.filename} -->`);
      lines.push("");

      // Add rule title as heading
      const title =
        rule.frontmatter.title || rule.filename.replace(/\.md$/, "");
      lines.push(`## ${title}`);
      lines.push("");

      // Add description if present
      if (rule.frontmatter.description) {
        lines.push(rule.frontmatter.description);
        lines.push("");
      }

      // Add conditions
      const conditions = this.formatConditions(rule.frontmatter);
      if (conditions) {
        lines.push(conditions);
        lines.push("");
      }

      // Strip starter rule comments and add content
      const cleanedContent = this.stripStarterRuleComment(rule.content);
      lines.push(cleanedContent);
    }

    const content = lines.join("\n");

    // Check size threshold (50KB) and emit warning
    const sizeInBytes = new TextEncoder().encode(content).length;
    const sizeInKB = sizeInBytes / 1024;

    const result: { content: string; warning?: string } = { content };
    if (sizeInKB > 50) {
      result.warning = `Combined rule content is ${sizeInKB.toFixed(1)}KB. Consider using content_mode: links for better AI agent reliability with large rule sets.`;
    }

    return result;
  }
}

export default GenericMarkdownExporter;
