/**
 * Cursor .mdc exporter
 * Exports AlignTrue rules to Cursor's .cursor/rules/*.mdc format
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
import { getAlignTruePaths } from "@aligntrue/core";
import { ExporterBase } from "../base/index.js";

export class CursorExporter extends ExporterBase {
  name = "cursor";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true, // Multi-file format (.mdc files)
    twoWaySync: true, // Supports editing and pullback
    scopeAware: true, // Can filter by scope
    preserveStructure: true, // Maintains file organization
    nestedDirectories: true, // Supports nested scope directories
  };

  // NOTE: Cursor always uses native frontmatter format (modeHints='native')
  // This ensures round-trip fidelity for vendor.cursor fields
  // The mode_hints config is intentionally ignored for this exporter

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    // Handle empty sections gracefully (valid in early setup)
    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Cursor always uses native frontmatter format, ignore config
    // This preserves round-trip fidelity for vendor.cursor fields
    const _modeHints = "native"; // Force native, ignore config

    const paths = getAlignTruePaths(outputDir);
    const managedSections =
      (options as { managedSections?: string[] }).managedSections || [];

    // Group sections by target scope (vendor.aligntrue.source_scope)
    const sectionsByScope = this.groupSectionsByScope(sections, scope);

    // Export each scope group to its file
    const allFilesWritten: string[] = [];
    const allWarnings: string[] = [];
    let combinedContentHash = "";

    for (const [targetScope, scopeSections] of sectionsByScope.entries()) {
      // Determine output path for this scope
      // For non-default scopes, write to nested directory structure
      let outputPath: string;
      if (targetScope === "default" || scope.isDefault) {
        // Default scope: write to root .cursor/rules/aligntrue.mdc
        outputPath = paths.cursorRules("default");
      } else {
        // Named scope: write to scope-specific nested directory
        // e.g., apps/web/.cursor/rules/web.mdc
        const scopeName = targetScope.split("/").pop() || targetScope;
        outputPath = paths.cursorRulesScoped(targetScope, scopeName);
      }

      // Merge with existing file to preserve user-added sections
      const mergeResult = await this.readAndMerge(
        outputPath,
        scopeSections,
        "cursor-mdc",
        managedSections,
      );

      // Generate .mdc content from merged sections
      const content = this.generateMdcFromSections(
        scope, // Use original scope for metadata
        mergeResult.mergedSections,
        options.unresolvedPlugsCount,
        managedSections,
        options.config, // Pass config for source markers
      );
      const contentHash = computeContentHash({
        scope,
        sections: mergeResult.mergedSections,
      });
      const fidelityNotes = this.computeSectionFidelityNotes(
        mergeResult.mergedSections,
      );

      // Combine merge warnings with fidelity notes
      allWarnings.push(...mergeResult.warnings, ...fidelityNotes);

      // Write file atomically if not dry-run
      const filesWritten = await this.writeFile(outputPath, content, dryRun);
      allFilesWritten.push(...filesWritten);

      // Use first scope's hash as combined hash
      if (!combinedContentHash) {
        combinedContentHash = contentHash;
      }
    }

    return this.buildResult(allFilesWritten, combinedContentHash, allWarnings);
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

  /**
   * Generate scope-specific filename
   * Default scope (path: ".") → "aligntrue.mdc"
   * Named scope → "{normalized-path}.mdc" (slashes → hyphens)
   */
  private getScopeFilename(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "aligntrue.mdc";
    }

    // Normalize path: replace slashes with hyphens
    const normalized = scope.normalizedPath.replace(/\//g, "-");
    return `${normalized}.mdc`;
  }

  /**
   * Generate .mdc content from natural markdown sections
   * Extracts Cursor-specific frontmatter from vendor metadata, applies smart defaults
   */
  private generateMdcFromSections(
    scope: ResolvedScope,
    sections: AlignSection[],
    unresolvedPlugs?: number,
    managedSections: string[] = [],
    config?: unknown,
  ): string {
    // Extract Cursor-specific metadata from first section's vendor bag
    const frontmatter = this.generateFrontmatterFromSections(scope, sections);

    // Generate sections with source markers
    let sectionsContent = "";
    for (const section of sections) {
      // Add source marker before section
      const marker = this.generateSourceMarker(section, config);
      if (marker) {
        sectionsContent += `${marker}\n`;
      }

      // Render the section with team-managed markers
      sectionsContent += this.renderSectionsWithManaged(
        [section],
        false,
        managedSections,
      );
    }

    // No footer - keep files clean
    // Fidelity notes will be shown in CLI output instead

    return `${frontmatter}\n${sectionsContent}`;
  }

  /**
   * Generate Cursor frontmatter from sections
   * Extracts vendor.cursor metadata or applies smart defaults
   * Includes scope globs if scope has include patterns
   */
  private generateFrontmatterFromSections(
    scope: ResolvedScope,
    sections: AlignSection[],
  ): string {
    const lines: string[] = ["---"];

    // Check first section for Cursor-specific vendor metadata
    const firstSection = sections[0];
    const cursorVendor = firstSection?.vendor?.["cursor"] as
      | Record<string, unknown>
      | undefined;

    // Smart defaults for Cursor
    if (cursorVendor) {
      // Use explicit vendor metadata if present (bracket notation for index signature)
      if (cursorVendor["alwaysApply"]) {
        lines.push("alwaysApply: true");
      } else if (cursorVendor["intelligent"]) {
        lines.push("intelligent: true");
        if (cursorVendor["description"]) {
          lines.push(`description: ${cursorVendor["description"]}`);
        }
      }

      // Globs from vendor metadata
      const globs = cursorVendor["globs"];
      if (globs && Array.isArray(globs) && globs.length > 0) {
        const hasSpecificGlobs = !(globs.length === 1 && globs[0] === "**/*");
        if (hasSpecificGlobs) {
          lines.push(`globs:`);
          globs.forEach((glob: string) => {
            lines.push(`  - "${glob}"`);
          });
        }
      }

      // Title and tags
      if (cursorVendor["title"]) {
        lines.push(`title: ${cursorVendor["title"]}`);
      }
      if (
        cursorVendor["tags"] &&
        Array.isArray(cursorVendor["tags"]) &&
        cursorVendor["tags"].length > 0
      ) {
        lines.push("tags:");
        cursorVendor["tags"].forEach((tag: string) => {
          lines.push(`  - ${tag}`);
        });
      }
    } else {
      // Apply smart defaults for generic markdown
      // Default to "always" mode for natural markdown (most user-friendly)
      lines.push("alwaysApply: true");
    }

    // Add scope globs if scope has include patterns
    // Only add if not already present from vendor metadata
    if (scope.include && scope.include.length > 0 && !cursorVendor?.["globs"]) {
      lines.splice(lines.length - 1, 0, "globs:");
      scope.include.forEach((glob: string) => {
        lines.splice(lines.length - 1, 0, `  - "${glob}"`);
      });
    }

    lines.push("---");
    return lines.join("\n");
  }
}
