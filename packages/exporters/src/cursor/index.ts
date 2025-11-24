/**
 * Cursor .mdc exporter
 * Exports AlignTrue rules to Cursor's .cursor/rules/*.mdc format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "@aligntrue/plugin-contracts";
import type { RuleFrontmatter } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";
import { join } from "path";
import yaml from "js-yaml";

export class CursorExporter extends ExporterBase {
  name = "cursor";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true, // Multi-file format (.mdc files)
    twoWaySync: false, // No longer supports two-way sync
    scopeAware: true, // Can filter by scope
    preserveStructure: true, // Maintains file organization
    nestedDirectories: true, // Supports nested scope directories
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with pack)
    const rules = this.getRulesFromRequest(request);

    const allFilesWritten: string[] = [];
    const allWarnings: string[] = [];
    let combinedContentHash = "";

    // Hash of all exported content
    const contentHashes: string[] = [];

    for (const rule of rules) {
      if (!this.shouldExportRule(rule, "cursor")) {
        continue;
      }

      // Determine output path
      // If rule has nested_location, put it there.
      // Else put in root .cursor/rules/
      const nestedLoc = rule.frontmatter.nested_location;
      const filename = rule.filename.replace(/\.md$/, ".mdc");

      let outputPath: string;
      if (nestedLoc) {
        outputPath = join(outputDir, nestedLoc, ".cursor/rules", filename);
      } else {
        outputPath = join(outputDir, ".cursor/rules", filename);
      }

      // Generate content
      const cursorFrontmatter = this.translateFrontmatter(rule.frontmatter);

      // Add read-only marker to content (not frontmatter)
      // We put the read-only marker as an HTML comment after frontmatter
      const readOnlyMarker = this.renderReadOnlyMarker(outputPath);

      // Stringify frontmatter using js-yaml directly
      const yamlContent = yaml.dump(cursorFrontmatter, {
        sortKeys: true,
        noRefs: true,
      });
      const frontmatterStr = `---\n${yamlContent}---`;

      // Construct full file content
      const fullContent = `${frontmatterStr}\n\n${readOnlyMarker}\n${rule.content}`;

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

  override translateFrontmatter(
    frontmatter: RuleFrontmatter,
  ): Record<string, unknown> {
    const cursorMeta = frontmatter["cursor"] || {};
    const result: Record<string, unknown> = { ...cursorMeta };

    // Map common fields if not already present in cursor meta
    if (frontmatter["description"] && !result["description"]) {
      result["description"] = frontmatter["description"];
    }

    if (frontmatter["globs"] && !result["globs"]) {
      result["globs"] = frontmatter["globs"];
    }

    // If apply_to is present, map to 'when' if not present?
    // Cursor uses 'alwaysApply' usually.
    // If apply_to is "alwaysOn", set alwaysApply: true?
    // Or just leave it to cursor meta.
    if (
      frontmatter["apply_to"] === "alwaysOn" &&
      result["alwaysApply"] === undefined
    ) {
      result["alwaysApply"] = true;
    }

    return result;
  }
}
