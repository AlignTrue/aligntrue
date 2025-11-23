/**
 * Detection Output Formatter
 * Handles tiered verbosity for untracked file detection output
 *
 * Supports multiple output modes:
 * - Default: Compact summary with hint for more details
 * - --verbose: Show top files sorted by section count
 * - -vv (--verbose twice): Show all files with timestamps and sizes
 * - --json: Structured output for scripting
 * - --quiet: Suppress all output
 *
 * This improves UX for workspaces with many rule files (e.g., 15 Cursor files)
 * by providing progressive disclosure - basic info by default, details on demand.
 */

import type { DetectedFileWithContent } from "./detect-agents.js";

export interface FormattingOptions {
  verbose?: boolean;
  verboseFull?: boolean;
  json?: boolean;
  quiet?: boolean;
}

export interface AgentDetectionSummary {
  agentName: string;
  displayName: string;
  fileCount: number;
  totalSections: number;
  isMultiFile: boolean;
}

export interface FormattedOutput {
  text: string;
  json?: Record<string, unknown>;
}

/**
 * Determine if an agent format is multi-file (directory-based)
 */
export function isMultiFileFormat(agentName: string): boolean {
  return ["cursor", "amazonq", "augmentcode", "kilocode", "kiro"].includes(
    agentName,
  );
}

/**
 * Format file with summary for --verbose output
 */
function formatFileForVerbose(file: DetectedFileWithContent): string {
  return `◇  • ${file.relativePath} - ${file.sectionCount} sections`;
}

/**
 * Format file with full details for --verbose=full output
 */
function formatFileForVerboseFull(file: DetectedFileWithContent): string {
  const timeAgo = getTimeAgo(file.lastModified);
  const sizeKb = (file.size / 1024).toFixed(1);
  return `◇  • ${file.relativePath} - ${file.sectionCount} sections, modified ${timeAgo} (${sizeKb}KB)`;
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/**
 * Build agent detection summary from files
 */
export function buildAgentSummary(
  agentName: string,
  displayName: string,
  files: DetectedFileWithContent[],
): AgentDetectionSummary {
  const totalSections = files.reduce((sum, f) => sum + f.sectionCount, 0);
  return {
    agentName,
    displayName,
    fileCount: files.length,
    totalSections,
    isMultiFile: isMultiFileFormat(agentName),
  };
}

/**
 * Format detection output with tiered verbosity
 *
 * Default: Show compact summary only + hint to use --verbose
 * --verbose: Show summary + top 5 files by section count + indicator for others
 * --verbose=full: Show everything like current behavior (all files, all details)
 */
export function formatDetectionOutput(
  summaries: AgentDetectionSummary[],
  allFiles: Map<string, DetectedFileWithContent[]>,
  options: FormattingOptions = {},
): FormattedOutput {
  const {
    verbose = false,
    verboseFull = false,
    json = false,
    quiet = false,
  } = options;

  if (quiet) {
    return { text: "" };
  }

  if (json) {
    return {
      text: "",
      json: {
        detected: Object.fromEntries(
          summaries.map((s) => [
            s.agentName,
            {
              display_name: s.displayName,
              files: s.fileCount,
              sections: s.totalSections,
              is_multi_file: s.isMultiFile,
            },
          ]),
        ),
      },
    };
  }

  let output = "";

  // Default: Show compact summary
  if (!verbose && !verboseFull) {
    const agentList = summaries
      .map(
        (s) =>
          `${s.agentName} (${s.fileCount} file${s.fileCount !== 1 ? "s" : ""})`,
      )
      .join(", ");
    output += `⚠ Detected new content: ${agentList}\n`;
    output += `  Run with --verbose to see file details\n`;
    return { text: output };
  }

  // Verbose: Show detailed output
  output += "▲  ⚠ Detected new content outside tracked files\n";
  output += "│\n";

  // Summary line for each agent
  for (const summary of summaries) {
    const plural = summary.fileCount !== 1 ? "files" : "file";
    output += `●    ${summary.agentName}: ${summary.fileCount} ${plural}, ${summary.totalSections} sections detected\n`;
  }

  output += "│\n";

  output += "│\n";

  // File details
  if (verboseFull) {
    // Show all files with full details
    for (const summary of summaries) {
      const files = allFiles.get(summary.agentName) || [];
      if (files.length > 0) {
        output += `◇  ${summary.displayName}:\n`;
        for (const file of files) {
          output += formatFileForVerboseFull(file) + "\n";
        }
      }
    }
  } else {
    // Show top 5 files per agent
    for (const summary of summaries) {
      const files = allFiles.get(summary.agentName) || [];
      if (files.length > 0) {
        // Sort by section count descending
        const sorted = [...files].sort(
          (a, b) => b.sectionCount - a.sectionCount,
        );
        const topFiles = sorted.slice(0, 5);
        const otherCount = files.length - topFiles.length;

        output += `◇  ${summary.displayName} (${topFiles.length}${otherCount > 0 ? `/${files.length}` : ""} files):\n`;

        for (const file of topFiles) {
          output += formatFileForVerbose(file) + "\n";
        }

        if (otherCount > 0) {
          output += `◇  ... and ${otherCount} more files\n`;
        }
      }
    }
  }

  return { text: output };
}

/**
 * Check if new agent is multi-file and current source is single-file
 * Returns true if switch is recommended
 *
 * This is used internally in the unified onboarding flow but exported for testing
 */
export function shouldRecommendEditSourceSwitch(
  newAgents: string[],
  currentEditSource: string | string[] | undefined,
): { should_recommend: boolean; agent?: string; reason?: string } {
  // 1. Check if current source is already multi-file
  // If so, NEVER recommend switching (we don't upgrade multi->multi or multi->single)
  const currentSources = Array.isArray(currentEditSource)
    ? currentEditSource
    : currentEditSource
      ? [currentEditSource]
      : [];

  const isCurrentMultiFile = currentSources.some(
    (src) =>
      src.includes(".cursor/rules") ||
      src.includes(".amazonq/rules") ||
      src.includes(".augment/rules") ||
      src.includes(".kilocode/rules") ||
      src.includes(".kiro/steering") ||
      src.includes("*"), // Generic glob assumption
  );

  if (isCurrentMultiFile) {
    return {
      should_recommend: false,
      reason: "Current source is already multi-file",
    };
  }

  // 2. Find best upgrade candidate (multi-file agent)
  const newMultiFileAgent = newAgents.find((a) => isMultiFileFormat(a));

  if (!newMultiFileAgent) {
    return {
      should_recommend: false,
      reason: "No multi-file agent detected to upgrade to",
    };
  }

  // 3. If we got here: Current is single-file (or undefined) AND we found a multi-file agent
  return {
    should_recommend: true,
    agent: newMultiFileAgent,
    reason: "New multi-file agent detected with single-file current source",
  };
}
