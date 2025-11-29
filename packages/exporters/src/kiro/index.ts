/**
 * Kiro exporter
 * Exports AlignTrue rules to Kiro .kiro/steering/*.md format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "../types.js";
import { ExporterBase } from "../base/index.js";

export class KiroExporter extends ExporterBase {
  name = "kiro";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true, // Multi-file format (.kiro/steering/*.md)
    scopeAware: true, // Can filter by scope
    preserveStructure: true, // Maintains file organization
    nestedDirectories: true, // Supports nested scope directories
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with align.sections)
    const rules = this.getRulesFromRequest(request);

    const allFilesWritten: string[] = [];
    const allWarnings: string[] = [];
    let combinedContentHash = "";

    // Hash of all exported content
    const contentHashes: string[] = [];

    for (const rule of rules) {
      if (!this.shouldExportRule(rule, "kiro")) {
        continue;
      }

      // Determine output path
      // Use relativePath to preserve source directory structure
      const ruleRelPath = rule.relativePath || rule.filename;
      const outputPath = join(outputDir, ".kiro", "steering", ruleRelPath);

      // Strip starter rule comments from content (only relevant in source files, not exports)
      const cleanedContent = this.stripStarterRuleComment(rule.content);

      // Add read-only marker to content
      const readOnlyMarker = this.renderReadOnlyMarker(outputPath);

      // Construct full file content with heading from rule title
      const fullContent = `# ${rule.frontmatter.title || "Rule"}\n\n${readOnlyMarker}\n${cleanedContent}`;

      // Always compute content hash (for dry-run to return meaningful hash)
      contentHashes.push(rule.hash);

      // Write file
      const files = await this.writeFile(
        outputPath,
        fullContent,
        dryRun,
        { ...options, force: true }, // Always force overwrite for read-only exports
      );

      if (files.length > 0) {
        allFilesWritten.push(...files);
      }
    }

    if (contentHashes.length > 0) {
      combinedContentHash = this.computeHash(contentHashes.sort().join(""));
    }

    return this.buildResult(allFilesWritten, combinedContentHash, allWarnings);
  }

  resetState(): void {
    // Stateless exporter, nothing to reset
  }
}

export default KiroExporter;
