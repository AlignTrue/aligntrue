/**
 * AGENTS.md exporter
 * Exports AlignTrue rules to universal AGENTS.md format
 *
 * Format: Single root-level AGENTS.md file with v1 versioned structure
 * Target agents: Claude, Copilot, Aider, and other AGENTS.md-compatible tools
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { getAlignTruePaths } from "@aligntrue/core";
import { ExporterBase } from "../base/index.js";

/**
 * State for collecting all scopes before generating single merged file
 */
interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  seenScopes: Set<string>;
}

export class AgentsMdExporter extends ExporterBase {
  name = "agents-md";
  version = "1.0.0";

  // State for accumulating sections across multiple scope calls
  private state: ExporterState = {
    allSections: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    // Validate inputs
    if (sections.length === 0) {
      // Empty scope is allowed, just skip accumulation
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate content with scope information
    const scopePath = this.formatScopePath(scope);

    // Natural markdown sections
    sections.forEach((section) => {
      this.state.allSections.push({ section, scopePath });
    });

    this.state.seenScopes.add(scopePath);

    // For AGENTS.md, we generate the file only on the first export call
    // In real usage, sync engine would need to signal "last scope" or we'd need
    // a different pattern. For now, we generate immediately for each call.
    // This matches the test expectations where each test case is independent.

    const paths = getAlignTruePaths(outputDir);
    const outputPath = paths.agentsMd();

    // Get managed sections from options
    const managedSections =
      (options as { managedSections?: string[] }).managedSections || [];

    // Get scope prefixing config from options
    const scopePrefixing =
      (options as { scopePrefixing?: "off" | "auto" | "always" })
        .scopePrefixing || "off";

    // Merge with existing file to preserve user-added sections
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const mergeResult = await this.readAndMerge(
      outputPath,
      allSectionsIR,
      "agents-md",
      managedSections,
    );

    // Generate AGENTS.md content - natural markdown mode
    const result = this.generateSectionsContent(
      mergeResult.mergedSections,
      options.unresolvedPlugsCount,
      managedSections,
      scopePrefixing,
    );
    const content = result.content;
    const warnings = [...result.warnings, ...mergeResult.warnings];

    // Compute content hash from merged sections
    const contentHash = computeContentHash({
      sections: mergeResult.mergedSections,
    });
    const fidelityNotes = this.computeSectionFidelityNotes(
      mergeResult.mergedSections,
    );

    // Write file atomically if not dry-run
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options.backupOptions,
    );

    const exportResult = this.buildResult(filesWritten, contentHash, [
      ...warnings,
      ...fidelityNotes,
    ]);

    return exportResult;
  }

  /**
   * Format scope path for display in AGENTS.md
   * Default scope (path: ".") → "all files"
   * Named scope → actual path
   */
  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  /**
   * Generate AGENTS.md content from natural markdown sections
   * Much simpler than rule-based format - just render sections as-is
   * Optionally adds scope prefixes based on config
   */
  private generateSectionsContent(
    sections: AlignSection[],
    unresolvedPlugs?: number,
    managedSections: string[] = [],
    scopePrefixing: "off" | "auto" | "always" = "off",
  ): {
    content: string;
    warnings: string[];
  } {
    const header = this.generateHeader();

    // Render sections with team-managed markers and optional scope prefixes
    const sectionsMarkdown = this.renderSectionsWithPrefixes(
      sections,
      managedSections,
      scopePrefixing,
    );

    // No footer - keep files clean
    // Fidelity notes will be shown in CLI output instead

    return {
      content: `${header}\n\n${sectionsMarkdown}`,
      warnings: [],
    };
  }

  /**
   * Render sections with optional scope prefixes
   * Adds scope prefixes to headings based on vendor.aligntrue.source_scope
   */
  private renderSectionsWithPrefixes(
    sections: AlignSection[],
    managedSections: string[] = [],
    scopePrefixing: "off" | "auto" | "always" = "off",
  ): string {
    if (sections.length === 0) {
      return "";
    }

    // Check if we need prefixing
    const shouldPrefix = scopePrefixing !== "off";

    // For "auto" mode, check if multiple scopes are present
    const hasMultipleScopes =
      scopePrefixing === "auto" &&
      new Set(sections.map((s) => s.vendor?.aligntrue?.source_scope)).size > 1;

    const rendered = sections.map((section) => {
      const lines: string[] = [];

      // Check if team-managed
      const isManaged = managedSections.some(
        (managed) =>
          managed.toLowerCase().trim() === section.heading.toLowerCase().trim(),
      );

      if (isManaged) {
        lines.push(
          "<!-- [TEAM-MANAGED]: This section is managed by your team.",
        );
        lines.push(
          "Local edits will be preserved in backups but may be overwritten on next sync.",
        );
        lines.push(
          "To keep changes, rename the section or remove from managed list. -->",
        );
        lines.push("");
      }

      // Determine heading with optional scope prefix
      let heading = section.heading;
      const sourceScope = section.vendor?.aligntrue?.source_scope;

      if (shouldPrefix && sourceScope && sourceScope !== "default") {
        // Add prefix if:
        // - scopePrefixing is "always", OR
        // - scopePrefixing is "auto" AND multiple scopes detected
        if (scopePrefixing === "always" || hasMultipleScopes) {
          // Capitalize first letter of scope
          const scopeName =
            sourceScope.charAt(0).toUpperCase() + sourceScope.slice(1);
          heading = `${scopeName}: ${heading}`;
        }
      }

      // Heading with proper level
      const headingPrefix = "#".repeat(section.level);
      lines.push(`${headingPrefix} ${heading}`);
      lines.push("");

      // Content
      lines.push(section.content.trim());

      return lines.join("\n");
    });

    return rendered.join("\n\n");
  }

  /**
   * Generate v1 format header
   */
  private generateHeader(): string {
    const lines: string[] = [];

    lines.push("# AGENTS.md");
    lines.push("");
    lines.push("**Version:** v1");
    lines.push("**Generated by:** AlignTrue");
    lines.push("");
    lines.push("This file contains rules and guidance for AI coding agents.");

    return lines.join("\n");
  }

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    this.state = {
      allSections: [],
      seenScopes: new Set(),
    };
  }
}
