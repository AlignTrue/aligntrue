/**
 * Import command - analyze and import rules from agent formats
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
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
import { writeFile } from "fs/promises";
import type { AlignRule } from "@aligntrue/schema";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";

/**
 * Argument definitions for import command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--coverage",
    hasValue: false,
    description: "Show import coverage report (default: true)",
  },
  {
    flag: "--no-coverage",
    hasValue: false,
    description: "Skip coverage report",
  },
  {
    flag: "--write",
    hasValue: false,
    description: "Write imported rules to .aligntrue/rules.md",
  },
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview without writing files",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

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
 */
async function writeToIRFile(
  rules: AlignRule[],
  dryRun: boolean,
): Promise<void> {
  const paths = getAlignTruePaths();
  const irPath = paths.rules;
  const yaml = await import("yaml");

  // Generate single-block IR format
  const pack = {
    id: "imported-rules",
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

  const content = lines.join("\n");

  if (dryRun) {
    console.log("\nPreview of .aligntrue/rules.md:");
    console.log("─".repeat(50));
    console.log(content.split("\n").slice(0, 30).join("\n"));
    if (content.split("\n").length > 30) {
      console.log("... (truncated)");
    }
  } else {
    await writeFile(irPath, content, "utf-8");
    clack.log.success(`Wrote ${rules.length} rules to ${irPath}`);
  }
}

/**
 * Import command entry point
 */
export async function importCommand(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Extract agent from positional args
  const agent = parsed.positional[0];

  // Show help if requested or no agent specified
  if (parsed.help || !agent) {
    showStandardHelp({
      name: "import",
      description: "Analyze and import rules from agent formats",
      usage: "aligntrue import <agent> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue import cursor",
        "aligntrue import agents-md",
        "aligntrue import cursor --write",
        "aligntrue import cursor --write --dry-run",
      ],
      notes: [
        "Arguments:",
        "  agent              Agent format to analyze (cursor, agents-md)",
        "",
        "Supported Agents:",
        "  cursor             .cursor/rules/*.mdc files (imports ALL .mdc files)",
        "  agents-md          AGENTS.md universal format",
        "  copilot            AGENTS.md format (alias)",
        "  claude-code        AGENTS.md format (alias)",
        "  aider              AGENTS.md format (alias)",
        "",
        "Notes:",
        "  - Cursor import scans ALL .mdc files in .cursor/rules/ directory",
        "  - This includes starter files and synced files - review before --write",
        "  - Coverage report shows field-level mapping from agent format to IR",
        "  - 70-80% coverage is typical and expected for agent formats",
        "  - Lower coverage doesn't mean data loss - unmapped fields preserved in vendor.*",
        "  - Import preserves vendor.* metadata for round-trip fidelity",
        "  - Use --write carefully to avoid overwriting current rules",
        "  - Recommend: backup rules before import with --write",
      ],
    });
    process.exit(parsed.help ? 0 : 1);
  }

  // Extract flags
  const showCoverage = parsed.flags["no-coverage"] ? false : true; // Default: true
  const write = (parsed.flags["write"] as boolean | undefined) || false;
  const dryRun = (parsed.flags["dry-run"] as boolean | undefined) || false;

  const workspaceRoot = process.cwd();

  clack.intro("Import from agent format");

  // Step 1: Validate agent support
  if (!canImportFromAgent(agent)) {
    clack.log.error(`Import not supported for agent: ${agent}`);
    clack.log.info(
      "Supported agents: cursor, agents-md, copilot, claude-code, aider",
    );
    process.exit(1);
  }

  // Step 2: Check if source exists
  const sourcePath = getImportSourcePath(agent, workspaceRoot);
  if (!existsSync(sourcePath)) {
    clack.log.error(`Agent format not found: ${sourcePath}`);

    if (agent === "cursor") {
      clack.log.info("Expected: .cursor/rules/ directory with .mdc files");
    } else {
      clack.log.info("Expected: AGENTS.md file in workspace root");
    }

    process.exit(1);
  }

  // Step 3: Import rules
  const spinner = clack.spinner();
  spinner.start("Importing rules");

  let rules: AlignRule[];
  try {
    rules = await importFromAgent(agent, workspaceRoot);
    spinner.stop(`Imported ${rules.length} rules from ${agent}`);
  } catch (error) {
    spinner.stop("Import failed");
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  if (rules.length === 0) {
    clack.log.warn("No rules found in agent format");
    process.exit(0);
  }

  // Step 4: Generate and display coverage report
  if (showCoverage) {
    try {
      const report = generateCoverageReport(agent, rules);
      const formatted = formatCoverageReport(report);

      console.log("");
      console.log(formatted);
      console.log("");
    } catch (error) {
      clack.log.warn(
        `Coverage analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Step 5: Write to IR file if requested
  if (write) {
    try {
      await writeToIRFile(rules, dryRun);

      // Show success message with next steps
      if (!dryRun) {
        console.log("");
        clack.log.success(
          "Your " + agent + " rules are now in AlignTrue IR format.",
        );
        console.log("");
        console.log("Next steps:");
        console.log("  1. Review imported rules: .aligntrue/rules.md");
        console.log("  2. Sync to other agents: aligntrue sync");
        console.log("");
        console.log(
          "Tip: Edit .aligntrue/rules.md to customize rules for your project",
        );
      }
    } catch (error) {
      clack.log.error(
        `Failed to write IR file: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  } else {
    // Show next steps for preview mode
    console.log("");
    console.log("Import complete (preview only)");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Review the import above");
    console.log("  2. Write to IR: aligntrue import " + agent + " --write");
    console.log("  3. Then sync: aligntrue sync");
  }

  clack.outro("");
}
