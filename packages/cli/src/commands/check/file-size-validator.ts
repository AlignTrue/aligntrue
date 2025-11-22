/**
 * File size validation for check command
 * Extracted from check.ts for better maintainability
 */

import { resolve } from "path";
import { existsSync } from "fs";
import type { AlignTrueConfig } from "@aligntrue/core";

/**
 * Validate file organization and return warnings for large files
 * Analyzes edit_source files and warns if they exceed size thresholds
 *
 * @param config - AlignTrue configuration
 * @param cwd - Current working directory
 * @returns Array of warning messages for large files
 */
export async function validateFileOrganization(
  config: AlignTrueConfig,
  cwd: string,
): Promise<string[]> {
  const warnings: string[] = [];

  try {
    const { analyzeFiles, getLargeFiles } = await import(
      "../../utils/file-size-detector.js"
    );
    const { DEFAULT_THRESHOLDS } = await import(
      "../../utils/file-size-detector.js"
    );

    // Get edit source files to analyze
    const editSource = config.sync?.edit_source;
    const filesToAnalyze: Array<{ path: string; relativePath: string }> = [];

    if (editSource) {
      const patterns = Array.isArray(editSource) ? editSource : [editSource];

      for (const pattern of patterns) {
        // Skip special patterns
        if (
          pattern === ".rules.yaml" ||
          pattern === "any_agent_file" ||
          pattern.includes("*")
        ) {
          continue;
        }

        // Check if file exists and add to analysis
        const fullPath = resolve(cwd, pattern);
        if (existsSync(fullPath)) {
          filesToAnalyze.push({
            path: fullPath,
            relativePath: pattern,
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
          `${large.relativePath} is very large (${large.lineCount} lines). Consider splitting: aligntrue sources split`,
        );
      }
    }
  } catch {
    // Silent failure on file size analysis - not critical for validation
  }

  return warnings;
}
