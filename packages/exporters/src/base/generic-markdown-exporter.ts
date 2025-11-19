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

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

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
    );
    const content = result.content;
    const warnings = result.warnings;

    const contentHash = computeContentHash({ sections: scopeSections });
    const fidelityNotes = this.computeSectionFidelityNotes(scopeSections);

    // Write file atomically if not dry-run
    const filesWritten = await this.writeFile(outputPath, content, dryRun);

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

  private generateSectionsContent(
    sections: AlignSection[],
    _unresolvedPlugs?: number,
  ): {
    content: string;
    warnings: string[];
  } {
    // Generate header
    const header = this.generateHeader();

    // Render sections as natural markdown
    const sectionsMarkdown = this.renderSections(sections, false);

    // No footer - keep files clean
    // Fidelity notes will be shown in CLI output instead

    return {
      content: `${header}\n\n${sectionsMarkdown}`,
      warnings: [],
    };
  }

  /**
   * Generate file header with title, version, and description
   */
  private generateHeader(): string {
    const lines: string[] = [];

    lines.push(`# ${this.title}`);
    lines.push("");
    lines.push("**Version:** v1");
    lines.push("**Generated by:** AlignTrue");
    lines.push("");
    lines.push(`This file contains rules and guidance ${this.description}.`);

    return lines.join("\n");
  }
}

export default GenericMarkdownExporter;
