/**
 * Rule importer for init command
 *
 * Scans for existing agent files and imports them as AlignTrue rules.
 * Uses parseRuleFile() from core to treat each file as a single rule.
 */

import {
  detectNestedAgentFiles,
  parseRuleFile,
  type RuleFile,
} from "@aligntrue/core";

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
