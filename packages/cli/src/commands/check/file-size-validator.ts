/**
 * File size validation for check command
 * Extracted from check.ts for better maintainability
 */

import { join } from "path";
import { existsSync, readdirSync, statSync } from "fs";
import type { AlignTrueConfig } from "@aligntrue/core";

/**
 * Validate file organization and return warnings for large files
 * Analyzes .aligntrue/rules/*.md files and warns if they exceed size thresholds
 *
 * @param config - AlignTrue configuration
 * @param cwd - Current working directory
 * @returns Array of warning messages for large files
 */
export async function validateFileOrganization(
  _config: AlignTrueConfig,
  cwd: string,
): Promise<string[]> {
  const warnings: string[] = [];

  try {
    const { analyzeFiles, getLargeFiles } =
      await import("../../utils/file-size-detector.js");
    const { DEFAULT_THRESHOLDS } =
      await import("../../utils/file-size-detector.js");

    // In new architecture, analyze .aligntrue/rules/*.md files
    const rulesDir = join(cwd, ".aligntrue", "rules");
    const filesToAnalyze: Array<{ path: string; relativePath: string }> = [];

    if (existsSync(rulesDir)) {
      const files = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));

      for (const file of files) {
        const fullPath = join(rulesDir, file);
        const stat = statSync(fullPath);

        if (stat.isFile()) {
          filesToAnalyze.push({
            path: fullPath,
            relativePath: `.aligntrue/rules/${file}`,
          });
        }
      }
    }

    // Analyze files if we have any
    if (filesToAnalyze.length > 0) {
      // Use urgent threshold (1500 lines) for check command
      const urgentThreshold = {
        warning: DEFAULT_THRESHOLDS.urgent,
        urgent: DEFAULT_THRESHOLDS.urgent,
      };

      const analyses = analyzeFiles(filesToAnalyze, urgentThreshold);
      const largeFiles = getLargeFiles(analyses, false); // Only urgent files

      for (const large of largeFiles) {
        warnings.push(
          `${large.relativePath} is very large (${large.lineCount} lines). Consider splitting into smaller rules.`,
        );
      }
    }
  } catch {
    // Silent failure on file size analysis - not critical for validation
  }

  return warnings;
}
