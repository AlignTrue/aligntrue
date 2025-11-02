/**
 * Import helper - Shared import logic for init and import commands
 * Provides reusable import flow with coverage analysis
 */

import { existsSync } from "fs";
import { writeFile } from "fs/promises";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import {
  importFromAgent,
  canImportFromAgent,
  getImportSourcePath,
  getAlignTruePaths,
} from "@aligntrue/core";
import {
  analyzeCursorCoverage,
  analyzeAgentsMdCoverage,
  formatCoverageReport,
  type CoverageReport,
} from "@aligntrue/markdown-parser";
import type { AlignRule } from "@aligntrue/schema";

/**
 * Import execution options
 */
export interface ImportOptions {
  /** Show coverage report */
  showCoverage: boolean;
  /** Write imported rules to IR file */
  writeToIR: boolean;
  /** Interactive mode (show prompts and spinners) */
  interactive: boolean;
  /** Project ID for pack generation */
  projectId?: string;
}

/**
 * Import execution result
 */
export interface ImportResult {
  /** Imported rules */
  rules: AlignRule[];
  /** Coverage report (if requested) */
  coverage?: CoverageReport;
  /** Whether rules were written to IR */
  written: boolean;
  /** Path to IR file (if written) */
  irPath?: string;
}

/**
 * Execute import from agent format
 *
 * Reusable import flow for both init and import commands.
 * Handles validation, coverage analysis, and IR file writing.
 *
 * @param agent - Agent name (cursor, agents-md, etc.)
 * @param workspaceRoot - Workspace root directory
 * @param options - Import execution options
 * @returns Import result with rules and optional coverage
 */
export async function executeImport(
  agent: string,
  workspaceRoot: string,
  options: ImportOptions,
): Promise<ImportResult> {
  const { showCoverage, writeToIR, interactive, projectId } = options;

  // Step 1: Validate agent support
  if (!canImportFromAgent(agent)) {
    throw new Error(
      `Import not supported for agent: ${agent}. Supported: cursor, cursorrules, agents-md, claude-md, crush-md, warp-md, copilot, claude-code, aider`,
    );
  }

  // Step 2: Check if source exists
  const sourcePath = getImportSourcePath(agent, workspaceRoot);
  if (!existsSync(sourcePath)) {
    const hint =
      agent === "cursor"
        ? "Expected: .cursor/rules/ directory with .mdc files"
        : agent === "cursorrules"
          ? "Expected: .cursorrules file in workspace root"
          : "Expected: AGENTS.md file in workspace root";
    throw new Error(`Agent format not found: ${sourcePath}\n${hint}`);
  }

  // Step 3: Import rules with spinner
  let spinner: ReturnType<typeof clack.spinner> | null = null;
  if (interactive) {
    spinner = clack.spinner();
    spinner.start("Importing rules");
  }

  let rules: AlignRule[];
  try {
    rules = await importFromAgent(agent, workspaceRoot);
    if (interactive && spinner) {
      spinner.stop(`Imported ${rules.length} rules from ${agent}`);
    }
  } catch (error) {
    if (interactive && spinner) {
      spinner.stop("Import failed");
    }
    throw error;
  }

  if (rules.length === 0) {
    throw new Error(`No rules found in ${agent} format`);
  }

  // Step 4: Generate coverage report
  let coverage: CoverageReport | undefined;
  if (showCoverage) {
    try {
      coverage = generateCoverageReport(agent, rules);

      if (interactive) {
        console.log("");
        console.log(formatCoverageReport(coverage));
        console.log("");
        console.log(
          "Note: Unmapped fields preserved in vendor.* for round-trip fidelity",
        );
        console.log("");
      }
    } catch (error) {
      if (interactive) {
        clack.log.warn(
          `Coverage analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // Step 5: Write to IR file if requested
  let written = false;
  let irPath: string | undefined;

  if (writeToIR) {
    const paths = getAlignTruePaths(workspaceRoot);
    irPath = paths.rules;

    try {
      await writeToIRFile(rules, irPath, projectId || "imported-rules");
      written = true;

      if (interactive) {
        clack.log.success(`Wrote ${rules.length} rules to ${irPath}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to write IR file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    rules,
    ...(coverage !== undefined && { coverage }),
    written,
    ...(irPath !== undefined && { irPath }),
  };
}

/**
 * Generate coverage report for imported rules
 */
function generateCoverageReport(
  agent: string,
  rules: AlignRule[],
): CoverageReport {
  const normalizedAgent = agent.toLowerCase();

  if (normalizedAgent === "cursor") {
    return analyzeCursorCoverage(rules);
  } else if (
    ["agents-md", "copilot", "claude-code", "aider"].includes(normalizedAgent)
  ) {
    return analyzeAgentsMdCoverage(rules);
  } else {
    throw new Error(`Coverage analysis not available for agent: ${agent}`);
  }
}

/**
 * Write imported rules to IR file in single-block format
 *
 * Format: Markdown with one fenced ```aligntrue block containing full pack
 *
 * CRITICAL: Must use single-block format
 * - Parser expects ONE aligntrue block per section
 * - Multi-block format (one block per rule) will fail validation
 *
 * @param rules - Imported rules from agent format
 * @param irPath - Path to IR file
 * @param projectId - Project ID for pack
 */
async function writeToIRFile(
  rules: AlignRule[],
  irPath: string,
  projectId: string,
): Promise<void> {
  // Generate single-block IR format
  const pack = {
    id: projectId,
    version: "1.0.0",
    spec_version: "1",
    rules: rules.map((rule) => {
      const ruleData: Record<string, any> = {
        id: rule.id,
        severity: rule.severity,
        applies_to: rule.applies_to,
      };

      if (rule.guidance) {
        ruleData["guidance"] = rule.guidance;
      }

      if (rule.tags && rule.tags.length > 0) {
        ruleData["tags"] = rule.tags;
      }

      if (rule.mode) {
        ruleData["mode"] = rule.mode;
      }

      if (rule.title) {
        ruleData["title"] = rule.title;
      }

      if (rule.description) {
        ruleData["description"] = rule.description;
      }

      if (rule.vendor) {
        ruleData["vendor"] = rule.vendor;
      }

      if (rule.check) {
        ruleData["check"] = rule.check;
      }

      if (rule.autofix) {
        ruleData["autofix"] = rule.autofix;
      }

      return ruleData;
    }),
  };

  // Generate markdown with single fenced block
  const lines: string[] = [];
  lines.push("# AlignTrue Rules");
  lines.push("");
  lines.push("Rules imported from agent format.");
  lines.push("");
  lines.push("```aligntrue");

  // Convert to YAML and add to lines
  const yamlContent = yaml.stringify(pack, {
    lineWidth: 0, // Don't wrap long lines
    indent: 2,
  });

  lines.push(yamlContent.trim());
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Next steps");
  lines.push("");
  lines.push("1. **Review imported rules** - Check the rules above");
  lines.push("2. **Customize for your project** - Edit as needed");
  lines.push("3. **Sync to agents** - Run `aligntrue sync`");
  lines.push("");
  lines.push("Learn more: https://aligntrue.dev/docs");

  const content = lines.join("\n");
  await writeFile(irPath, content, "utf-8");
}
