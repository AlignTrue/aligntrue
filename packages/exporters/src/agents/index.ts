/**
 * AGENTS.md exporter
 * Exports AlignTrue rules as links to .aligntrue/rules/*.md files
 *
 * Format: AGENTS.md file with links to rule files (not concatenated content)
 * Target agents: Claude, Copilot, Aider, and other AGENTS.md-compatible tools
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "@aligntrue/plugin-contracts";
import type { RuleFile, RuleFrontmatter } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";
import { join } from "path";

export class AgentsExporter extends ExporterBase {
  name = "agents";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: false, // Single file format
    scopeAware: true, // Can filter by scope
    preserveStructure: false, // Link-based, doesn't preserve file structure
    nestedDirectories: true, // Supports nested scope directories
  };

  override async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with align)
    const rules = this.getRulesFromRequest(request);

    // Filter rules that should be exported to this agent
    const exportableRules = rules.filter((rule) =>
      this.shouldExportRule(rule, "agents"),
    );

    if (exportableRules.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Group rules by nested location for proper AGENTS.md placement
    const rulesByLocation = this.groupRulesByLocation(exportableRules);

    const allFilesWritten: string[] = [];
    const contentHashes: string[] = [];
    const warnings: string[] = [];

    // Determine content mode from CLI option or config
    let contentMode: "auto" | "inline" | "links" =
      (options.contentMode as "auto" | "inline" | "links" | undefined) ||
      "auto";

    // Get config for accessing sync.content_mode
    const alignConfig = options.config as Record<string, unknown> | undefined;
    if (alignConfig && !options.contentMode) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const syncConfig = (alignConfig as any)["sync"] as
        | Record<string, unknown>
        | undefined;
      const configContentMode = syncConfig?.["content_mode"] as
        | string
        | undefined;
      if (configContentMode) {
        // Config takes precedence only if CLI option not provided
        contentMode = configContentMode as "auto" | "inline" | "links";
      }
    }

    for (const [location, locationRules] of rulesByLocation.entries()) {
      // Determine output path
      const outputPath =
        location === ""
          ? join(outputDir, "AGENTS.md")
          : join(outputDir, location, "AGENTS.md");

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
    // AGENTS.md uses minimal frontmatter - just title and description
    const result: Record<string, unknown> = {};

    if (frontmatter["title"]) {
      result["title"] = frontmatter["title"];
    }

    if (frontmatter["description"]) {
      result["description"] = frontmatter["description"];
    }

    // Include agents-specific metadata if present
    if (frontmatter["agents"]) {
      Object.assign(result, frontmatter["agents"]);
    }

    return result;
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
    if (frontmatter.globs?.length) {
      const globList = frontmatter.globs.map((g) => `\`${g}\``).join(", ");
      parts.push(`For files: ${globList}.`);
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
   * Generate link-based AGENTS.md content
   */
  private generateLinkBasedContent(
    rules: RuleFile[],
    location: string,
    _outputDir: string, // Unused but kept for potential future use
  ): string {
    const lines: string[] = [];

    // Read-only marker
    lines.push(`<!--
  READ-ONLY: This file is auto-generated by AlignTrue.
  DO NOT EDIT DIRECTLY. Changes will be overwritten.
  Edit rules in .aligntrue/rules/ instead.
-->`);
    lines.push("");

    // Header
    lines.push("# Agent Rules");
    lines.push("");
    lines.push(
      "This file contains links to the canonical rules in `.aligntrue/rules/`.",
    );
    lines.push("AI agents should follow these linked guidelines.");
    lines.push("");

    // Group rules by category (using scope or a default "General" category)
    const rulesByCategory = this.groupRulesByCategory(rules);

    for (const [category, categoryRules] of rulesByCategory.entries()) {
      lines.push(`## ${category}`);
      lines.push("");

      for (const rule of categoryRules) {
        const title =
          rule.frontmatter.title || rule.filename.replace(/\.md$/, "");
        const description = rule.frontmatter.description || "";
        const conditions = this.formatConditions(rule.frontmatter);

        // Compute relative path from AGENTS.md to the rule file
        const rulesDir =
          location === "" ? ".aligntrue/rules" : `${location}/.aligntrue/rules`;
        // Use relativePath if available (preserves nested structure), fallback to filename
        const ruleFileName = rule.relativePath || rule.filename;
        const linkPath = `./${rulesDir}/${ruleFileName}`;

        // Format: [Title](path): description. conditions.
        if (description && conditions) {
          lines.push(
            `- [${title}](${linkPath}): ${description}. ${conditions}`,
          );
        } else if (description) {
          lines.push(`- [${title}](${linkPath}): ${description}`);
        } else if (conditions) {
          lines.push(`- [${title}](${linkPath}): ${conditions}`);
        } else {
          lines.push(`- [${title}](${linkPath})`);
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
      // Use scope as category, or "General" if no scope
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

    // Capitalize and clean up scope path
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
    lines.push(`<!--
  READ-ONLY: This file is auto-generated by AlignTrue.
  DO NOT EDIT DIRECTLY. Changes will be overwritten.
  Edit rules in .aligntrue/rules/ instead.
-->`);
    lines.push("");

    // Header
    lines.push("# Agent Rules");
    lines.push("");
    lines.push(
      "This file contains the canonical rules from `.aligntrue/rules/`.",
    );
    lines.push("AI agents should follow these guidelines.");
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

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    // No state to reset in new implementation
  }
}
