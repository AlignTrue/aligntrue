/**
 * OpenHands exporter
 * Exports AlignTrue rules to OpenHands .openhands/microagents/ directory format
 * Each rule becomes a separate microagent file (one .md per rule)
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import type { RuleFile } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

export class OpenHandsExporter extends ExporterBase {
  name = "openhands";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false } = options;

    // Get rules from request (handles backward compatibility with align)
    const rules = this.getRulesFromRequest(request);

    // Filter rules that should be exported to this agent
    const exportableRules = rules.filter((rule) =>
      this.shouldExportRule(rule, "openhands"),
    );

    if (exportableRules.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const allFilesWritten: string[] = [];
    const contentHashes: string[] = [];

    // Write each rule as a separate microagent file
    for (const rule of exportableRules) {
      const filename = rule.filename;
      const outputPath = join(outputDir, ".openhands", "microagents", filename);

      // Generate content from rule
      const { content } = this.generateMicroagentContent(rule);

      // Always compute content hash (for dry-run to return meaningful hash)
      contentHashes.push(rule.hash);

      // Write file
      const files = await this.writeFile(outputPath, content, dryRun, options);

      if (files.length > 0) {
        allFilesWritten.push(...files);
      }
    }

    const combinedHash =
      contentHashes.length > 0
        ? this.computeHash(contentHashes.sort().join(""))
        : "";

    // Compute fidelity notes from the IR sections
    const fidelityNotes = this.computeSectionFidelityNotes(
      request.align.sections,
    );

    return this.buildResult(allFilesWritten, combinedHash, fidelityNotes);
  }

  /**
   * Generate OpenHands microagent content from a single rule
   */
  private generateMicroagentContent(rule: RuleFile): {
    content: string;
    warnings: string[];
  } {
    const lines: string[] = [];

    const title = rule.frontmatter.title || rule.filename.replace(/\.md$/, "");
    lines.push(`# ${title}`);
    lines.push("");

    // Add description if present
    if (rule.frontmatter.description) {
      lines.push(rule.frontmatter.description);
      lines.push("");
    }

    // Render rule content as natural markdown
    lines.push(rule.content);

    return { content: lines.join("\n"), warnings: [] };
  }

  resetState(): void {
    // Stateless exporter, nothing to reset
  }
}

// Maintain backward compatibility
export { OpenHandsExporter as OpenhandsExporter };

export default OpenHandsExporter;
