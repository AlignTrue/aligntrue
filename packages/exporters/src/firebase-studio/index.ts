/**
 * Firebase Studio exporter
 * Exports AlignTrue rules to Firebase IDX's .idx/*.md multi-file format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "../types.js";
import { normalizePath } from "@aligntrue/core";
import { join } from "path";
import { ExporterBase } from "../base/index.js";

export class FirebaseStudioExporter extends ExporterBase {
  name = "firebase-studio";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true, // Multi-file format (.md files)
    scopeAware: true, // Can filter by scope
    preserveStructure: true, // Maintains file organization
    nestedDirectories: true, // Supports nested scope directories
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with align)
    const rules = this.getRulesFromRequest(request);

    const allFilesWritten: string[] = [];
    const allWarnings: string[] = [];
    let combinedContentHash = "";

    // Hash of all exported content
    const contentHashes: string[] = [];

    for (const rule of rules) {
      if (!this.shouldExportRule(rule, "firebase-studio")) {
        continue;
      }

      // Determine output path
      // Use relativePath to preserve source directory structure
      // nested_location is for monorepo scopes (different concept)
      const ruleRelPath = rule.relativePath || rule.filename;
      let outputPath: string;
      const nestedLoc = rule.frontmatter.nested_location
        ? normalizePath(rule.frontmatter.nested_location)
        : undefined;
      if (nestedLoc) {
        outputPath = join(outputDir, nestedLoc, ".idx", ruleRelPath);
      } else {
        outputPath = join(outputDir, ".idx", ruleRelPath);
      }

      // Prepare content
      const cleanedContent = this.stripStarterRuleComment(rule.content);
      const readOnlyMarker = this.renderReadOnlyMarker(outputPath);
      const fullContent = `# ${rule.frontmatter.title || "Rule"}\n\n${readOnlyMarker}\n${cleanedContent}`;

      // Always compute content hash
      contentHashes.push(rule.hash);

      // Write file
      const files = await this.writeFile(outputPath, fullContent, dryRun, {
        ...options,
        force: true,
      });

      if (files.length > 0) {
        allFilesWritten.push(...files);
      }
    }

    if (contentHashes.length > 0) {
      combinedContentHash = this.computeHash(contentHashes.sort().join(""));
    }

    return this.buildResult(allFilesWritten, combinedContentHash, allWarnings);
  }
}

export default FirebaseStudioExporter;
