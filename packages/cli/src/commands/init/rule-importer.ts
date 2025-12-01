/**
 * Rule importer for init command
 *
 * Scans for existing agent files and imports them as AlignTrue rules.
 * Uses parseRuleFile() from core to treat each file as a single rule.
 */

import { dirname } from "path";
import {
  detectNestedAgentFiles,
  parseRuleFile,
  type RuleFile,
} from "@aligntrue/core";

/**
 * Extract the nested location from a relative path
 *
 * For files in nested directories, extracts the parent path before the agent-specific
 * directory structure. This is used to set nested_location in frontmatter so exports
 * go back to the original nested location.
 *
 * @example
 * extractNestedLocation("apps/docs/.cursor/rules/web_stack.mdc", "cursor")
 * // returns "apps/docs"
 *
 * extractNestedLocation("packages/cli/AGENTS.md", "agents")
 * // returns "packages/cli"
 *
 * extractNestedLocation(".cursor/rules/global.mdc", "cursor")
 * // returns undefined (root level)
 *
 * @param relativePath Relative path to the file
 * @param type Type of agent file (cursor, agents, claude, other)
 * @returns The nested location or undefined if at root level
 */
export function extractNestedLocation(
  relativePath: string,
  type: string,
): string | undefined {
  const dir = dirname(relativePath);

  // Agent-specific directory suffixes to strip
  const suffixes: Record<string, string[]> = {
    cursor: [".cursor/rules", ".cursor"],
    agents: [], // AGENTS.md is directly in its directory
    claude: [], // CLAUDE.md is directly in its directory
    other: [],
  };

  const typeSuffixes = suffixes[type] || [];

  // Try to strip agent-specific suffixes from the directory path
  for (const suffix of typeSuffixes) {
    if (suffix && dir.endsWith(suffix)) {
      const location = dir.slice(0, -suffix.length).replace(/\/$/, "");
      if (location && location !== ".") {
        return location;
      }
      return undefined;
    }
  }

  // For AGENTS.md and CLAUDE.md, the nested location is the parent directory
  // (since they sit directly in the directory, not in a subdirectory)
  if (type === "agents" || type === "claude") {
    if (dir && dir !== ".") {
      return dir;
    }
  }

  return undefined;
}

/**
 * Scan for existing agent files in the workspace and import them as rules
 *
 * Each detected file becomes one rule (not split by sections).
 * For users who want to split AGENTS.md into multiple files,
 * use `aligntrue sources split` after init.
 *
 * @param cwd Workspace root
 */
export async function scanForExistingRules(cwd: string): Promise<RuleFile[]> {
  const detectedFiles = await detectNestedAgentFiles(cwd);
  const importedRules: RuleFile[] = [];

  const now = new Date().toISOString().split("T")[0] ?? ""; // YYYY-MM-DD

  for (const file of detectedFiles) {
    // Use parseRuleFile from core - treats entire file as one rule
    const rule = parseRuleFile(file.path, cwd);

    // Add source metadata
    rule.frontmatter.source = file.type;
    rule.frontmatter.source_added = now;
    rule.frontmatter.original_path = file.relativePath;

    // Extract nested location from source path so exports go to the correct nested directory
    // e.g., "apps/docs/.cursor/rules/web_stack.mdc" -> nested_location: "apps/docs"
    const nestedLocation = extractNestedLocation(file.relativePath, file.type);
    if (nestedLocation) {
      rule.frontmatter.nested_location = nestedLocation;
    }

    // Convert .mdc extension to .md for AlignTrue rules directory
    if (rule.filename.endsWith(".mdc")) {
      rule.filename = rule.filename.slice(0, -4) + ".md";
    }
    if (rule.path.endsWith(".mdc")) {
      rule.path = rule.path.slice(0, -4) + ".md";
    }
    if (rule.relativePath?.endsWith(".mdc")) {
      rule.relativePath = rule.relativePath.slice(0, -4) + ".md";
    }

    importedRules.push(rule);
  }

  return importedRules;
}
