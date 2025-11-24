/**
 * Base class for exporters (Code consolidation)
 *
 * Consolidates common patterns across all exporters:
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
import { getPromptHandler } from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { AtomicFileWriter } from "@aligntrue/file-utils";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as SectionRenderer from "./section-renderer.js";
import * as FileMerger from "./file-merger.js";

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
   * Persistent atomic file writer with checksum tracking across all exports in a sync
   * Initialized with checksum conflict handler that respects CLI flags
   */
  protected writer: AtomicFileWriter = new AtomicFileWriter();

  /**
   * Store config for use in helper methods (subclasses may override with public property)
   */
  protected currentConfig?: unknown;

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
    return SectionRenderer.computeSectionFidelityNotes(
      sections,
      this.name,
      !!(this as unknown as ExporterPlugin).capabilities?.multiFile,
    );
  }

  /**
   * Generate source marker comment for a section
   *
   * Creates an HTML comment marker showing which source file a section came from.
   * Respects the sync.source_markers config setting.
   *
   * @param section - Section to generate marker for
   * @param config - AlignTrue config (from options.config)
   * @returns HTML comment marker or empty string
   *
   * @example
   * ```typescript
   * const marker = this.generateSourceMarker(section, options.config);
   * // "<!-- aligntrue:source security.md -->\n"
   * ```
   */
  protected generateSourceMarker(
    section: AlignSection,
    config?: unknown,
  ): string {
    return SectionRenderer.generateSourceMarker(section, config);
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
    return SectionRenderer.renderSections(sections, includeVendor);
  }

  /**
   * Write file atomically with dry-run support
   *
   * Uses persistent AtomicFileWriter for safe file operations with checksum tracking
   * and conflict resolution based on interactive/force flags.
   * Returns empty array if dry-run is enabled.
   *
   * @param path - File path to write
   * @param content - File content (string)
   * @param dryRun - If true, skip actual write
   * @param options - Export options (interactive, force flags)
   * @returns Array with single path if written, empty if dry-run
   *
   * @example
   * ```typescript
   * const written = await this.writeFile(outputPath, content, dryRun, options);
   * // Returns: [outputPath] or []
   * ```
   */
  protected async writeFile(
    path: string,
    content: string,
    dryRun: boolean,
    options?: ExportOptions,
  ): Promise<string[]> {
    if (dryRun) {
      return [];
    }

    const interactive = options?.interactive ?? false;
    const force = options?.force ?? false;

    // SAFETY: Backup file if it will be overwritten after manual edits
    if (options) {
      const { existsSync } = await import("fs");
      const { computeFileChecksum } = await import("@aligntrue/file-utils");
      const { safeBackupFile } = await import("@aligntrue/core");

      if (existsSync(path)) {
        const lastChecksumRecord = this.writer.getChecksum(path);

        if (lastChecksumRecord) {
          try {
            const currentChecksum = computeFileChecksum(path);

            if (currentChecksum !== lastChecksumRecord.checksum) {
              // File was manually edited - backup before overwriting
              safeBackupFile(path, process.cwd());
            }
          } catch {
            // If checksum fails, continue (file might not exist anymore)
          }
        }
      }
    }

    // Set checksum handler on first write to enable conflict resolution
    if (!this.writer.getChecksum(path)) {
      this.writer.setChecksumHandler(this.handleChecksumConflict.bind(this));
    }

    // Debug logging for file writes
    const DEBUG_EXPORT = process.env["DEBUG_EXPORT"] === "true";
    if (DEBUG_EXPORT) {
      console.log(`[${this.name}] Writing file: ${path}`);
      console.log(
        `[${this.name}] Content length: ${content.length}, force: ${force}, interactive: ${interactive}`,
      );
    }

    try {
      await this.writer.write(path, content, { interactive, force });
      if (DEBUG_EXPORT) {
        console.log(`[${this.name}] Successfully wrote: ${path}`);
      }
    } catch (error) {
      if (DEBUG_EXPORT) {
        console.error(`[${this.name}] Failed to write ${path}:`, error);
      }
      // Re-throw to let caller handle
      throw error;
    }

    return [path];
  }

  /**
   * Handle checksum conflicts when files have been manually edited
   *
   * Called by AtomicFileWriter when a file's checksum doesn't match the last known value.
   * Respects CLI flags: force always overwrites, interactive prompts user.
   *
   * @param filePath - Path to conflicted file
   * @param lastChecksum - Checksum from previous write
   * @param currentChecksum - Checksum of current file content
   * @param interactive - Whether user interaction is allowed
   * @param force - Whether to bypass all checks
   * @returns Decision: overwrite, keep (skip), or abort
   */
  protected async handleChecksumConflict(
    filePath: string,
    _lastChecksum: string,
    _currentChecksum: string,
    interactive: boolean,
    force: boolean,
  ): Promise<"overwrite" | "keep" | "abort"> {
    // Force flag always overwrites
    if (force) {
      return "overwrite";
    }

    // Interactive mode prompts user via global handler set by CLI
    if (interactive) {
      const promptHandler = getPromptHandler();
      if (promptHandler) {
        return await promptHandler(filePath);
      }
      // If no handler available, throw error
      throw new Error(
        `File has been manually edited: ${filePath}\n` +
          `  Use --force to overwrite without prompting\n` +
          `  Interactive mode requires CLI to be initialized`,
      );
    }

    // Non-interactive without force: abort with helpful error
    throw new Error(
      `File has been manually edited: ${filePath}\n` +
        `  Use --force to overwrite or --yes to accept (requires --accept-agent for conflicts)\n` +
        `  Or run sync interactively without --non-interactive or --yes flags`,
    );
  }

  /**
   * Clear writer state between syncs
   * Call after completing all exports for a sync operation
   */
  protected clearWriterState(): void {
    this.writer.clear();
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
    formatType: "agents" | "cursor-mdc" | "generic",
    managedSections: string[] = [],
  ): Promise<{
    mergedSections: AlignSection[];
    userSections: FileMerger.ParsedSection[];
    stats: FileMerger.MergeStats;
    warnings: string[];
  }> {
    return FileMerger.readAndMerge(
      outputPath,
      irSections,
      formatType,
      managedSections,
    );
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
    return SectionRenderer.renderSectionsWithManaged(
      sections,
      includeVendor,
      managedSections,
    );
  }

  /**
   * Generate source attribution comment
   * Shows which files contributed sections to this export
   *
   * @param sections - Sections with vendor.aligntrue.source_file metadata
   * @returns HTML comment with source attribution
   *
   * @example
   * ```typescript
   * const comment = this.generateSourceAttribution(sections);
   * // Returns: <!-- Synced from: AGENTS.md, CLAUDE.md | Last sync: 2025-11-20T... -->
   * ```
   */
  protected generateSourceAttribution(sections: AlignSection[]): string {
    return SectionRenderer.generateSourceAttribution(sections);
  }

  /**
   * Normalize markdown content to fix common formatting issues
   * - Ensures proper spacing after horizontal rules
   * - Fixes concatenated headings
   *
   * @param content - Raw markdown content
   * @returns Normalized content with proper spacing
   */
  protected normalizeMarkdownFormatting(content: string): string {
    return SectionRenderer.normalizeMarkdownFormatting(content);
  }

  /**
   * Render read-only file marker
   *
   * Adds an HTML comment warning at the top of files that should not be edited.
   * Files are read-only if they don't match the edit_source configuration.
   *
   * @param currentFile - Current file path being exported
   * @param editSource - Edit source configuration from config
   * @param cwd - Current working directory for path resolution
   * @returns HTML comment marker if file is read-only, empty string if editable
   *
   * @example
   * ```typescript
   * const marker = this.renderReadOnlyMarker(
   *   "AGENTS.md",
   *   ".cursor/rules/*.mdc",
   *   "/path/to/project"
   * );
   * // Returns warning comment if AGENTS.md is not in edit_source
   * ```
   */
  protected renderReadOnlyMarker(
    currentFile: string,
    editSource: string | string[] | undefined,
    _cwd: string,
  ): string {
    return SectionRenderer.renderReadOnlyMarker(currentFile, editSource);
  }

  /**
   * Check if a file matches the edit_source configuration
   * Simplified version - ideally import from multi-file-parser
   */
  private matchesEditSource(
    filePath: string,
    editSource: string | string[] | undefined,
  ): boolean {
    return SectionRenderer.matchesEditSource(filePath, editSource);
  }
}

// Re-export types for convenience
import type { ParsedSection, MergeStats } from "../utils/section-matcher.js";
export type { ParsedSection, MergeStats };
