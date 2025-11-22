/**
 * Generic Markdown Exporter
 * Base class for all AGENTS.md-style exporters (CLAUDE.md, WARP.md, etc.)
 *
 * Provides configurable filename, title, and description while sharing
 * all core functionality: sections, rules, mode hints, prioritization, etc.
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
  ExporterCapabilities,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { join } from "path";
import { ExporterBase } from "./index.js";

/**
 * Generic configurable markdown exporter
 * Used as delegate for agent-specific exporters
 */
export class GenericMarkdownExporter extends ExporterBase {
  name: string;
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: false, // Single-file format
    twoWaySync: true, // Supports editing and pullback
    scopeAware: true, // Can filter by scope
    preserveStructure: false, // Concatenates everything
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
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    // Store config for use in helper methods
    this.currentConfig = options.config;

    const sections = pack.sections;

    // Debug logging flag (declared once at function level)
    const DEBUG_EXPORT = process.env["DEBUG_EXPORT"] === "true";

    // Validate inputs
    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Group sections by target scope (vendor.aligntrue.source_scope)
    const sectionsByScope = this.groupSectionsByScope(sections, scope);

    // Only process sections for the current scope
    const currentTargetScope = scope.isDefault
      ? "default"
      : scope.normalizedPath;
    const scopeSections = sectionsByScope.get(currentTargetScope) || [];

    // Debug logging for scope filtering
    if (DEBUG_EXPORT) {
      console.log(
        `[${this.name}] Export for scope: ${currentTargetScope}, total sections: ${sections.length}, filtered: ${scopeSections.length}`,
      );
      if (scopeSections.length === 0 && sections.length > 0) {
        const scopes = Array.from(sectionsByScope.keys());
        console.log(
          `[${this.name}] No sections for scope "${currentTargetScope}", available scopes: ${scopes.join(", ")}`,
        );
        // Log sample section scopes
        const sampleScopes = sections
          .slice(0, 3)
          .map((s) => s.vendor?.aligntrue?.source_scope || "no source_scope");
        console.log(
          `[${this.name}] Sample section source_scopes: ${sampleScopes.join(", ")}`,
        );
      }
    }

    if (scopeSections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Determine output path for this scope
    let outputPath: string;
    if (scope.isDefault) {
      // Default scope: write to root file (e.g. AGENTS.md)
      outputPath = join(outputDir, this.filename);
    } else {
      // Named scope: write to scope-specific nested directory
      // e.g., apps/web/AGENTS.md
      const scopePath = scope.normalizedPath || scope.path || ".";
      outputPath = join(outputDir, scopePath, this.filename);
    }

    // Generate content - natural markdown mode
    const result = this.generateSectionsContent(
      scopeSections,
      options.unresolvedPlugsCount,
      outputPath, // Pass output path for read-only check
    );
    const content = result.content;
    const warnings = result.warnings;

    const contentHash = computeContentHash({ sections: scopeSections });
    const fidelityNotes = this.computeSectionFidelityNotes(scopeSections);

    // Write file atomically if not dry-run
    if (DEBUG_EXPORT) {
      console.log(
        `[${this.name}] About to write ${outputPath}, content length: ${content.length}, sections: ${scopeSections.length}`,
      );
    }

    let filesWritten: string[];
    try {
      filesWritten = await this.writeFile(outputPath, content, dryRun, options);
      if (DEBUG_EXPORT) {
        console.log(
          `[${this.name}] Write result for ${outputPath}: ${filesWritten.length} file(s) written`,
        );
      }
    } catch (error) {
      // Log error but don't fail silently
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (DEBUG_EXPORT) {
        console.error(
          `[${this.name}] Failed to write ${outputPath}: ${errorMsg}`,
        );
      }
      // Re-throw to let sync engine handle
      throw error;
    }

    return this.buildResult(filesWritten, contentHash, [
      ...warnings,
      ...fidelityNotes,
    ]);
  }

  resetState(): void {
    // No state to reset
  }

  /**
   * Group sections by their target scope
   * Uses vendor.aligntrue.source_scope if present, otherwise uses provided scope
   */
  private groupSectionsByScope(
    sections: AlignSection[],
    fallbackScope: ResolvedScope,
  ): Map<string, AlignSection[]> {
    const sectionsByScope = new Map<string, AlignSection[]>();

    for (const section of sections) {
      // Check for source_scope in vendor metadata
      const sourceScope = section.vendor?.aligntrue?.source_scope;
      const targetScope =
        sourceScope ||
        (fallbackScope.isDefault ? "default" : fallbackScope.normalizedPath);

      if (!sectionsByScope.has(targetScope)) {
        sectionsByScope.set(targetScope, []);
      }
      sectionsByScope.get(targetScope)!.push(section);
    }

    return sectionsByScope;
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  /**
   * Generate read-only warning header if this file is not the edit source
   */
  private generateReadOnlyHeader(outputPath: string): string {
    const config = this.currentConfig as
      | {
          sync?: {
            edit_source?: string | string[];
            centralized?: boolean;
          };
        }
      | undefined;
    if (!config) return "";

    const editSource = config.sync?.edit_source;
    const isDecentralized = config.sync?.centralized === false || false;

    if (!editSource || isDecentralized) return "";

    // Check if this output matches edit source pattern
    const patterns = Array.isArray(editSource) ? editSource : [editSource];
    const isEditSource = patterns.some((pattern) => {
      // Check for filename match (CLAUDE.md, WARP.md, etc.)
      if (
        pattern === this.filename &&
        outputPath.endsWith(`/${this.filename}`)
      ) {
        return true;
      }
      // Exact path match
      if (outputPath.endsWith(pattern)) {
        return true;
      }
      return false;
    });

    if (isEditSource) return "";

    // Not edit source - add read-only warning
    const sourceDisplay = Array.isArray(editSource)
      ? editSource.join(", ")
      : editSource;
    return `<!--
WARNING: Read-only export from AlignTrue

This file is automatically generated. Changes will be overwritten on next sync.

Edit source: ${sourceDisplay}
To modify these rules, edit ${sourceDisplay} instead, then run 'aligntrue sync'.
-->

`;
  }

  private generateSectionsContent(
    sections: AlignSection[],
    _unresolvedPlugs?: number,
    outputPath?: string,
  ): {
    content: string;
    warnings: string[];
  } {
    // Add read-only warning if not edit source
    const readOnlyWarning = outputPath
      ? this.generateReadOnlyHeader(outputPath)
      : "";

    // Generate sections with source markers
    let sectionsContent = "";
    for (const section of sections) {
      // Add source marker before section
      const marker = this.generateSourceMarker(section, this.currentConfig);
      if (marker) {
        sectionsContent += `\n${marker}`;
      }

      // Render the section
      sectionsContent += this.formatSection(section);
    }

    // No header or footer - keep files clean and editable
    // Content hash and fidelity notes shown in CLI output only

    return {
      content: (readOnlyWarning + sectionsContent).trim(),
      warnings: [],
    };
  }

  /**
   * Format a single section as markdown
   */
  private formatSection(section: AlignSection): string {
    // Use the base class renderSections method for a single section
    return this.renderSections([section], false);
  }
}

export default GenericMarkdownExporter;
