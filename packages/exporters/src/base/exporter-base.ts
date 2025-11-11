/**
 * Base class for exporters (Code consolidation)
 *
 * Consolidates common patterns across all 43 exporters:
 * - Content hash computation from canonical IR
 * - Fidelity notes generation
 * - Atomic file writing with dry-run support
 * - Manifest validation
 *
 * Reduces duplication by ~1,075 LOC across exporter implementations.
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  AdapterManifest,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * Abstract base class for all exporters
 *
 * Provides common functionality while allowing subclasses to implement
 * agent-specific export logic.
 */
export abstract class ExporterBase implements ExporterPlugin {
  abstract name: string;
  abstract version: string;

  /**
   * Subclasses must implement the export method
   */
  abstract export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult>;

  /**
   * Compute content hash from canonical IR
   *
   * Uses computeContentHash for deterministic hashing with
   * vendor.*.volatile field exclusion.
   *
   * @param irContent - IR content to hash (typically { scope?, rules })
   * @returns SHA-256 hex hash string
   *
   * @example
   * ```typescript
   * const hash = this.computeHash({ scope, rules });
   * ```
   */
  protected computeHash(irContent: unknown): string {
    return computeContentHash(irContent);
  }

  /**
   * Generate fidelity notes for sections-based format
   *
   * Analyzes sections for features that cannot be represented in the target
   * agent format and generates user-friendly notes.
   *
   * Common checks:
   * - Cross-agent vendor fields
   * - Unsupported metadata
   *
   * @param sections - Sections to analyze for fidelity issues
   * @returns Array of human-readable fidelity notes
   *
   * @example
   * ```typescript
   * const notes = this.computeSectionFidelityNotes(sections);
   * // ["Vendor-specific fields for other agents preserved: cursor"]
   * ```
   */
  protected computeSectionFidelityNotes(sections: AlignSection[]): string[] {
    const notes: string[] = [];
    const crossAgentVendors = new Set<string>();

    sections.forEach((section) => {
      // Check for cross-agent vendor fields
      if (section.vendor) {
        Object.keys(section.vendor).forEach((agent) => {
          if (agent !== this.name && agent !== "_meta") {
            crossAgentVendors.add(agent);
          }
        });
      }
    });

    // Generate notes for cross-agent vendor fields
    if (crossAgentVendors.size > 0) {
      const agents = Array.from(crossAgentVendors).join(", ");
      notes.push(
        `Vendor-specific fields for other agents preserved: ${agents}`,
      );
    }

    return notes;
  }

  /**
   * Render sections as natural markdown
   *
   * Converts AlignSection[] to clean markdown format with proper heading levels.
   * Preserves vendor metadata in HTML comments for round-trip compatibility.
   *
   * @param sections - Sections to render
   * @param includeVendor - Whether to include vendor metadata as HTML comments
   * @returns Rendered markdown string
   *
   * @example
   * ```typescript
   * const markdown = this.renderSections(sections, false);
   * // ## Testing
   * //
   * // Run tests before committing.
   * ```
   */
  protected renderSections(
    sections: AlignSection[],
    includeVendor = false,
  ): string {
    if (sections.length === 0) {
      return "";
    }

    const rendered = sections.map((section) => {
      const lines: string[] = [];

      // Heading with proper level
      const headingPrefix = "#".repeat(section.level);
      lines.push(`${headingPrefix} ${section.heading}`);
      lines.push("");

      // Add vendor metadata as HTML comment if requested and present
      if (includeVendor && section.vendor) {
        lines.push(
          `<!-- aligntrue:vendor ${JSON.stringify(section.vendor)} -->`,
        );
        lines.push("");
      }

      // Content
      lines.push(section.content.trim());

      return lines.join("\n");
    });

    return rendered.join("\n\n");
  }

  /**
   * Write file atomically with dry-run support
   *
   * Uses AtomicFileWriter for safe file operations.
   * Returns empty array if dry-run is enabled.
   *
   * @param path - File path to write
   * @param content - File content (string)
   * @param dryRun - If true, skip actual write
   * @returns Array with single path if written, empty if dry-run
   *
   * @example
   * ```typescript
   * const written = await this.writeFile(outputPath, content, dryRun);
   * // Returns: [outputPath] or []
   * ```
   */
  protected async writeFile(
    path: string,
    content: string,
    dryRun: boolean,
  ): Promise<string[]> {
    if (dryRun) {
      return [];
    }

    const writer = new AtomicFileWriter();
    writer.write(path, content);
    return [path];
  }

  /**
   * Load and validate manifest.json for this exporter
   *
   * Reads manifest.json from the exporter's directory and validates
   * required fields (name, version, format, etc.).
   *
   * @returns Parsed manifest object
   * @throws Error if manifest is missing or invalid
   *
   * @example
   * ```typescript
   * const manifest = this.validateManifest();
   * // { name: "cursor", version: "1.0.0", format: "mdc", ... }
   * ```
   */
  protected validateManifest(): AdapterManifest {
    try {
      // Construct path to manifest.json relative to this exporter
      const exporterDir = dirname(fileURLToPath(import.meta.url));
      const manifestPath = join(exporterDir, "manifest.json");

      const manifestContent = readFileSync(manifestPath, "utf-8");
      const manifest = JSON.parse(manifestContent);

      // Validate required fields
      const required = ["name", "version", "format"];
      const missing = required.filter((field) => !manifest[field]);

      if (missing.length > 0) {
        throw new Error(
          `Manifest missing required fields: ${missing.join(", ")}`,
        );
      }

      // Validate name matches
      if (manifest.name !== this.name) {
        throw new Error(
          `Manifest name "${manifest.name}" doesn't match exporter name "${this.name}"`,
        );
      }

      return manifest as AdapterManifest;
    } catch (_error) {
      if (_error instanceof Error) {
        throw new Error(`Manifest validation failed: ${_error.message}`);
      }
      throw _error;
    }
  }

  /**
   * Helper: Build ExportResult with standard structure
   *
   * Convenience method to construct ExportResult with consistent defaults.
   *
   * @param filesWritten - Array of file paths written
   * @param contentHash - Content hash string
   * @param fidelityNotes - Optional fidelity notes
   * @returns Structured ExportResult
   */
  protected buildResult(
    filesWritten: string[],
    contentHash: string,
    fidelityNotes?: string[],
  ): ExportResult {
    const result: ExportResult = {
      success: true,
      filesWritten,
      contentHash,
    };

    if (fidelityNotes && fidelityNotes.length > 0) {
      result.fidelityNotes = fidelityNotes;
    }

    return result;
  }

  /**
   * Read and merge existing file with IR sections
   *
   * Enables section-level merging: IR sections + user-added sections coexist.
   * Used for two-way sync and personal section preservation.
   *
   * @param outputPath - Path to existing agent file
   * @param irSections - Sections from IR
   * @param formatType - File format for parsing
   * @param managedSections - Array of team-managed section headings
   * @returns Merged sections, user sections, stats, and warnings
   *
   * @example
   * ```typescript
   * const merge = await this.readAndMerge(
   *   outputPath,
   *   pack.sections,
   *   'cursor-mdc',
   *   config.managed?.sections || []
   * );
   * // Use merge.mergedSections for export
   * ```
   */
  protected async readAndMerge(
    outputPath: string,
    irSections: AlignSection[],
    formatType: "agents-md" | "cursor-mdc" | "generic",
    managedSections: string[] = [],
  ): Promise<{
    mergedSections: AlignSection[];
    userSections: ParsedSection[];
    stats: MergeStats;
    warnings: string[];
  }> {
    const { existsSync } = await import("fs");
    const { matchSections, parsedToAlignSection } = await import(
      "../utils/section-matcher.js"
    );
    const { parseAgentsMd, parseCursorMdc, parseGenericMarkdown } =
      await import("../utils/section-parser.js");

    // If file doesn't exist, just return IR sections
    if (!existsSync(outputPath)) {
      return {
        mergedSections: irSections,
        userSections: [],
        stats: {
          kept: 0,
          updated: 0,
          added: irSections.length,
          userAdded: 0,
        },
        warnings: [],
      };
    }

    // Read and parse existing file
    const content = readFileSync(outputPath, "utf-8");
    let parsed;

    switch (formatType) {
      case "agents-md":
        parsed = parseAgentsMd(content);
        break;
      case "cursor-mdc":
        parsed = parseCursorMdc(content);
        break;
      case "generic":
        parsed = parseGenericMarkdown(content);
        break;
    }

    // Match IR sections with existing sections
    const { matches, stats } = matchSections(
      irSections,
      parsed.sections,
      managedSections,
    );

    // Build merged sections list
    const mergedSections: AlignSection[] = [];
    const userSections: ParsedSection[] = [];
    const warnings: string[] = [];

    // Add all IR sections (keep, update, or add)
    for (const match of matches) {
      if (match.action !== "user-added" && match.irSection) {
        mergedSections.push(match.irSection);
      }
    }

    // Add all user-added sections
    for (const match of matches) {
      if (match.action === "user-added" && match.existingSection) {
        userSections.push(match.existingSection);
        // Convert to AlignSection and add to merged list
        mergedSections.push(parsedToAlignSection(match.existingSection));
      }
    }

    // Generate warnings for merge operations
    if (stats.userAdded > 0) {
      warnings.push(
        `Preserved ${stats.userAdded} personal section${stats.userAdded !== 1 ? "s" : ""}`,
      );
    }

    if (stats.updated > 0) {
      warnings.push(
        `Updated ${stats.updated} section${stats.updated !== 1 ? "s" : ""} from IR`,
      );
    }

    return {
      mergedSections,
      userSections,
      stats,
      warnings,
    };
  }

  /**
   * Render sections with team-managed markers
   *
   * Enhanced version of renderSections that adds team-managed markers
   * for protected sections.
   *
   * @param sections - Sections to render
   * @param includeVendor - Whether to include vendor metadata
   * @param managedSections - Array of team-managed section headings
   * @returns Rendered markdown with team-managed markers
   */
  protected renderSectionsWithManaged(
    sections: AlignSection[],
    includeVendor: boolean,
    managedSections: string[] = [],
  ): string {
    if (sections.length === 0) {
      return "";
    }

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

      // Heading with proper level
      const headingPrefix = "#".repeat(section.level);
      lines.push(`${headingPrefix} ${section.heading}`);
      lines.push("");

      // Add vendor metadata as HTML comment if requested and present
      if (includeVendor && section.vendor) {
        lines.push(
          `<!-- aligntrue:vendor ${JSON.stringify(section.vendor)} -->`,
        );
        lines.push("");
      }

      // Content
      lines.push(section.content.trim());

      return lines.join("\n");
    });

    return rendered.join("\n\n");
  }
}

// Re-export types for convenience
import type { ParsedSection, MergeStats } from "../utils/section-matcher.js";
export type { ParsedSection, MergeStats };
