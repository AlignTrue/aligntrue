/**
 * File size detection utility
 * Detects large files and recommends splitting for better maintainability
 */

import { readFileSync, statSync } from "fs";
import { resolve } from "path";

/**
 * File size threshold configuration
 */
export interface FileSizeThresholds {
  /** Warning threshold in lines (default: 1000) */
  warning: number;
  /** Urgent threshold in lines (default: 1500) */
  urgent: number;
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: FileSizeThresholds = {
  warning: 1000,
  urgent: 1500,
};

/**
 * File size analysis result
 */
export interface FileSizeAnalysis {
  /** Absolute path to file */
  path: string;
  /** Relative path for display */
  relativePath: string;
  /** Number of lines in file */
  lineCount: number;
  /** File size in bytes */
  byteSize: number;
  /** Whether file exceeds warning threshold */
  isLarge: boolean;
  /** Whether file exceeds urgent threshold */
  isVeryLarge: boolean;
  /** Severity level */
  severity: "ok" | "warning" | "urgent";
  /** Recommendation message */
  recommendation: string | null;
}

/**
 * Count lines in a file
 */
export function countLines(filePath: string): number {
  try {
    const content = readFileSync(filePath, "utf-8");
    // Count newlines + 1 for last line if it doesn't end with newline
    const lines = content.split("\n");
    return lines.length;
  } catch {
    // File doesn't exist or can't be read
    return 0;
  }
}

/**
 * Analyze file size and provide recommendations
 */
export function analyzeFileSize(
  filePath: string,
  relativePath: string,
  thresholds: FileSizeThresholds = DEFAULT_THRESHOLDS,
): FileSizeAnalysis {
  const absolutePath = resolve(filePath);
  const lineCount = countLines(absolutePath);

  let byteSize = 0;
  try {
    const stats = statSync(absolutePath);
    byteSize = stats.size;
  } catch {
    // File doesn't exist or can't be read
  }

  const isLarge = lineCount >= thresholds.warning;
  const isVeryLarge = lineCount >= thresholds.urgent;

  let severity: "ok" | "warning" | "urgent" = "ok";
  let recommendation: string | null = null;

  if (isVeryLarge) {
    severity = "urgent";
    recommendation = `File is very large (${lineCount} lines). Strongly recommend splitting into multiple files: aligntrue sources split`;
  } else if (isLarge) {
    severity = "warning";
    recommendation = `File is large (${lineCount} lines). Consider splitting for easier management: aligntrue sources split`;
  }

  return {
    path: absolutePath,
    relativePath,
    lineCount,
    byteSize,
    isLarge,
    isVeryLarge,
    severity,
    recommendation,
  };
}

/**
 * Analyze multiple files
 */
export function analyzeFiles(
  files: Array<{ path: string; relativePath: string }>,
  thresholds: FileSizeThresholds = DEFAULT_THRESHOLDS,
): FileSizeAnalysis[] {
  return files.map((file) =>
    analyzeFileSize(file.path, file.relativePath, thresholds),
  );
}

/**
 * Get files that exceed thresholds
 */
export function getLargeFiles(
  analyses: FileSizeAnalysis[],
  includeWarnings = true,
): FileSizeAnalysis[] {
  if (includeWarnings) {
    return analyses.filter((a) => a.isLarge);
  }
  return analyses.filter((a) => a.isVeryLarge);
}

/**
 * Format file size analysis for display
 */
export function formatFileSizeWarning(analysis: FileSizeAnalysis): string {
  const icon = analysis.severity === "urgent" ? "⚠️" : "💡";
  return `${icon} ${analysis.relativePath}: ${analysis.recommendation}`;
}

/**
 * Format multiple file size warnings
 */
export function formatFileSizeWarnings(
  analyses: FileSizeAnalysis[],
  maxDisplay = 5,
): string {
  const largeFiles = getLargeFiles(analyses);

  if (largeFiles.length === 0) {
    return "";
  }

  const lines: string[] = [];

  if (largeFiles.length === 1) {
    lines.push("\n💡 Tip: Your rule file is getting large");
  } else {
    lines.push(`\n💡 Tip: ${largeFiles.length} rule files are getting large`);
  }

  const displayFiles = largeFiles.slice(0, maxDisplay);
  for (const file of displayFiles) {
    lines.push(`   ${file.relativePath} (${file.lineCount} lines)`);
  }

  if (largeFiles.length > maxDisplay) {
    lines.push(`   ... and ${largeFiles.length - maxDisplay} more`);
  }

  lines.push("\n   Consider splitting for easier management:");
  lines.push("   aligntrue sources split");

  return lines.join("\n");
}
