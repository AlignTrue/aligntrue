/**
 * Antigravity .md exporter
 * Exports AlignTrue rules to Antigravity's .agent/rules/*.md format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterCapabilities,
} from "@aligntrue/plugin-contracts";
import type { RuleFrontmatter } from "@aligntrue/schema";
import { normalizePath } from "@aligntrue/core";
import { ExporterBase } from "../base/index.js";
import { join } from "path";
import { stringify as stringifyYaml } from "yaml";

export class AntigravityExporter extends ExporterBase {
  name = "antigravity";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true,
    scopeAware: true,
    preserveStructure: true,
    nestedDirectories: true,
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    const rules = this.getRulesFromRequest(request);

    const allFilesWritten: string[] = [];
    const allWarnings: string[] = [];
    let combinedContentHash = "";
    const contentHashes: string[] = [];

    for (const rule of rules) {
      if (!this.shouldExportRule(rule, "antigravity")) {
        continue;
      }

      const nestedLoc = rule.frontmatter.nested_location
        ? normalizePath(rule.frontmatter.nested_location)
        : undefined;
      const ruleRelPath = rule.relativePath || rule.filename;
      const filename = ruleRelPath.replace(/\.md$/, ".md");

      let outputPath: string;
      if (nestedLoc) {
        outputPath = join(outputDir, nestedLoc, ".agent/rules", filename);
      } else {
        outputPath = join(outputDir, ".agent/rules", filename);
      }

      const antigravityFrontmatter = this.translateFrontmatter(
        rule.frontmatter,
      );
      const cleanedContent = this.stripStarterRuleComment(rule.content);
      const readOnlyMarker = this.renderReadOnlyMarker(outputPath);

      const yamlContent = stringifyYaml(antigravityFrontmatter);
      const frontmatterStr = `---\n${yamlContent}---`;
      const fullContent = `${frontmatterStr}\n\n${readOnlyMarker}\n${cleanedContent}`;

      contentHashes.push(rule.hash);

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

  override translateFrontmatter(
    frontmatter: RuleFrontmatter,
  ): Record<string, unknown> {
    const vendorMeta = frontmatter["antigravity"] || {};
    const result: Record<string, unknown> = { ...vendorMeta };

    if (frontmatter["description"] && !result["description"]) {
      result["description"] = frontmatter["description"];
    }

    if (frontmatter["globs"] && !result["globs"]) {
      result["globs"] = frontmatter["globs"];
    }

    if (
      frontmatter["apply_to"] === "alwaysOn" &&
      result["alwaysApply"] === undefined
    ) {
      result["alwaysApply"] = true;
    }

    return result;
  }
}

export default AntigravityExporter;
