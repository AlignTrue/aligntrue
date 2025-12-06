/**
 * Onboard command - Generate personalized developer onboarding checklist
 *
 * Analyzes recent work and generates actionable next steps for developers:
 * - Failed checks in last commit/PR
 * - Files modified by developer
 * - Common patterns (tests missing, linter errors)
 *
 * Integrations (added in Step 2):
 * - Drift detection (team mode)
 * - Check results parsing
 * - Plugs audit
 */

import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import * as clack from "@clack/prompts";
import { loadConfig, detectDriftForConfig } from "@aligntrue/core";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { exitWithError } from "../utils/error-formatter.js";
import { createManagedSpinner } from "../utils/spinner.js";
import { resolve } from "path";

/**
 * Argument definitions for onboard command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--ci",
    hasValue: true,
    description: "Read CI artifacts from path (SARIF files)",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Checklist item for onboarding
 */
interface ChecklistItem {
  status: "pending" | "info" | "warning";
  message: string;
  details?: string[];
  command?: string;
}

/**
 * Git analysis results
 */
interface GitAnalysis {
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
  modifiedFiles: string[];
  hasUncommitted: boolean;
}

/**
 * Analyze git history for recent work
 */
function analyzeGitHistory(): GitAnalysis {
  const analysis: GitAnalysis = {
    modifiedFiles: [],
    hasUncommitted: false,
  };

  try {
    // Check if we're in a git repo
    try {
      execSync("git rev-parse --git-dir", { stdio: "ignore" });
    } catch {
      return analysis; // Not a git repo
    }

    // Get last commit info
    try {
      const commitInfo = execSync(
        'git log -1 --pretty=format:"%H|%s|%an|%ai"',
        {
          encoding: "utf-8",
        },
      ).trim();

      if (commitInfo) {
        const [hash = "", message = "", author = "", date = ""] =
          commitInfo.split("|");
        analysis.lastCommit = { hash, message, author, date };
      }
    } catch {
      // No commits yet
    }

    // Get modified files in last commit
    if (analysis.lastCommit) {
      try {
        const files = execSync(
          "git diff-tree --no-commit-id --name-only -r HEAD",
          {
            encoding: "utf-8",
          },
        )
          .trim()
          .split("\n")
          .filter(Boolean);
        analysis.modifiedFiles.push(...files);
      } catch {
        // Unable to get file list
      }
    }

    // Check for uncommitted changes
    try {
      const status = execSync("git status --porcelain", {
        encoding: "utf-8",
      }).trim();
      analysis.hasUncommitted = status.length > 0;

      // Add modified files from working directory
      if (analysis.hasUncommitted) {
        const workingFiles = status
          .split("\n")
          .map((line) => line.substring(3).trim())
          .filter(Boolean);
        analysis.modifiedFiles.push(...workingFiles);
      }
    } catch {
      // Unable to check status
    }

    // Deduplicate files
    analysis.modifiedFiles = [...new Set(analysis.modifiedFiles)];
  } catch {
    // Git operations failed, return empty analysis
  }

  return analysis;
}

/**
 * Parse SARIF file for check results
 */
function parseSARIF(ciPath: string): {
  failedChecks: string[];
  warnings: string[];
} {
  const results = { failedChecks: [] as string[], warnings: [] as string[] };

  try {
    if (!existsSync(ciPath)) {
      return results;
    }

    const sarifContent = readFileSync(ciPath, "utf-8");
    const sarif = JSON.parse(sarifContent);

    // Parse SARIF format
    if (sarif.runs && Array.isArray(sarif.runs)) {
      for (const run of sarif.runs) {
        if (run.results && Array.isArray(run.results)) {
          for (const sarifResult of run.results) {
            const message = sarifResult.message?.text || "Unknown check failed";
            const level = sarifResult.level || "error";

            if (level === "error") {
              results.failedChecks.push(message);
            } else if (level === "warning") {
              results.warnings.push(message);
            }
          }
        }
      }
    }
  } catch {
    // SARIF parsing failed, return empty result
  }

  return results;
}

/**
 * Generate checklist based on analysis
 */
function generateChecklist(
  gitAnalysis: GitAnalysis,
  ciResults?: { failedChecks: string[]; warnings: string[] },
): ChecklistItem[] {
  const checklist: ChecklistItem[] = [];

  // Check for uncommitted changes
  if (gitAnalysis.hasUncommitted) {
    checklist.push({
      status: "warning",
      message: "Uncommitted changes detected",
      details: [
        "You have uncommitted changes in your working directory",
        "Consider committing or stashing before proceeding",
      ],
      command: "git status",
    });
  }

  // Check for modified test files
  const testFiles = gitAnalysis.modifiedFiles.filter(
    (f) => f.includes("test") || f.includes("spec") || f.endsWith(".test.ts"),
  );
  if (testFiles.length > 0) {
    checklist.push({
      status: "pending",
      message: `Run tests (${testFiles.length} test file${testFiles.length > 1 ? "s" : ""} modified)`,
      details: testFiles.slice(0, 5).map((f) => `  - ${f}`),
      command: "pnpm test",
    });
  }

  // Check for modified source files without tests
  const srcFiles = gitAnalysis.modifiedFiles.filter(
    (f) =>
      (f.endsWith(".ts") || f.endsWith(".js")) &&
      !f.includes("test") &&
      !f.includes("spec") &&
      (f.includes("/src/") || f.startsWith("src/")),
  );
  if (srcFiles.length > 0 && testFiles.length === 0) {
    checklist.push({
      status: "warning",
      message: "Source files modified without test updates",
      details: [
        "Consider adding or updating tests for:",
        ...srcFiles.slice(0, 3).map((f) => `  - ${f}`),
      ],
    });
  }

  // Check for modified documentation
  const docFiles = gitAnalysis.modifiedFiles.filter(
    (f) => f.endsWith(".md") && (f.includes("/docs/") || f.startsWith("docs/")),
  );
  if (docFiles.length > 0) {
    checklist.push({
      status: "info",
      message: "Documentation updated",
      details: docFiles.slice(0, 3).map((f) => `  - ${f}`),
    });
  }

  // Add CI check results if provided
  if (ciResults) {
    if (ciResults.failedChecks.length > 0) {
      checklist.push({
        status: "warning",
        message: `${ciResults.failedChecks.length} check${ciResults.failedChecks.length > 1 ? "s" : ""} failed`,
        details: ciResults.failedChecks.slice(0, 5),
        command: "aligntrue check",
      });
    }

    if (ciResults.warnings.length > 0) {
      checklist.push({
        status: "info",
        message: `${ciResults.warnings.length} warning${ciResults.warnings.length > 1 ? "s" : ""} from checks`,
        details: ciResults.warnings.slice(0, 3),
      });
    }
  }

  // Default helpful items if no specific issues found
  if (checklist.length === 0) {
    checklist.push({
      status: "info",
      message: "Run validation checks",
      command: "aligntrue check",
    });
    checklist.push({
      status: "info",
      message: "Sync rules to agents",
      command: "aligntrue sync",
    });
  }

  // Always add link to managing sources guide
  checklist.push({
    status: "info",
    message: "Add external rules from git sources",
    details: [
      "Learn how to combine your rules with team standards or community aligns",
    ],
  });

  return checklist;
}

/**
 * Get drift information (team mode only)
 */
async function getDriftInfo(configPath?: string): Promise<{
  hasDrift: boolean;
  driftCount: number;
  categories: string[];
} | null> {
  try {
    // Try to load config to check if team mode
    const config = await loadConfig(configPath);
    if (config.mode !== "team") {
      return null; // Not in team mode, skip drift
    }

    // Detect drift
    const driftResult = await detectDriftForConfig(config);

    if (!driftResult.driftDetected || !driftResult.drift) {
      return null;
    }

    const categories = new Set<string>();
    driftResult.drift.forEach((entry) => {
      categories.add(entry.category);
    });

    const driftCount = driftResult.drift.length;

    return {
      hasDrift: driftCount > 0,
      driftCount,
      categories: Array.from(categories),
    };
  } catch {
    return null; // Config not found or drift detection failed
  }
}

/**
 * Get unresolved plugs info
 */
async function getPlugsInfo(configPath?: string): Promise<{
  hasUnresolvedPlugs: boolean;
  unresolvedCount: number;
  unresolvedKeys: string[];
} | null> {
  try {
    const irPath = configPath || ".aligntrue.yaml";
    if (!existsSync(irPath)) {
      return null;
    }

    const irContent = readFileSync(irPath, "utf-8");
    const { parse: parseYaml } = await import("yaml");
    const ir = parseYaml(irContent) as {
      plugs?: {
        slots?: Record<string, { required?: boolean }>;
        fills?: Record<string, unknown>;
      };
    };

    if (!ir.plugs || !ir.plugs.slots) {
      return null; // No plugs defined
    }

    const slots = ir.plugs.slots || {};
    const fills = ir.plugs.fills || {};

    const unresolvedKeys = Object.keys(slots).filter((key) => {
      const slot = slots[key];
      return slot?.required && !fills[key];
    });

    return {
      hasUnresolvedPlugs: unresolvedKeys.length > 0,
      unresolvedCount: unresolvedKeys.length,
      unresolvedKeys,
    };
  } catch {
    return null; // IR parsing failed
  }
}

/**
 * Display checklist to user
 */
function displayChecklist(
  checklist: ChecklistItem[],
  gitAnalysis: GitAnalysis,
): void {
  console.log("\n🚀 Developer Onboarding Checklist\n");

  if (gitAnalysis.lastCommit) {
    console.log(`Based on your recent work:\n`);
    console.log(`  Last commit: ${gitAnalysis.lastCommit.message}`);
    console.log(`  By: ${gitAnalysis.lastCommit.author}`);
    console.log(
      `  Files changed: ${gitAnalysis.modifiedFiles.length || "none"}\n`,
    );
  }

  console.log("Actionable next steps:\n");

  checklist.forEach((item, index) => {
    const icon =
      item.status === "warning" ? "⚠️" : item.status === "info" ? "ℹ️" : "✅";
    console.log(`${index + 1}. ${icon} ${item.message}`);

    if (item.details && item.details.length > 0) {
      item.details.forEach((detail) => {
        console.log(`   ${detail}`);
      });
    }

    if (item.command) {
      console.log(`   → Run: ${item.command}`);
    }

    // Special handling for sources link
    if (item.message === "Add external rules from git sources") {
      console.log(`   → Learn more: aligntrue.ai/sources`);
    }

    console.log("");
  });
}

/**
 * Onboard command implementation
 */
export async function onboard(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (parsed.help) {
    showStandardHelp({
      name: "onboard",
      description: "Generate personalized onboarding checklist for developers",
      usage: "aligntrue onboard [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue onboard                    # Analyze git history",
        "aligntrue onboard --ci sarif.json    # Include CI check results",
      ],
      notes: [
        "Analyzes recent commits and file changes",
        "Integrates with team drift, checks, and plugs (Session 9 Step 2)",
        "Use --ci to include SARIF check results from CI",
      ],
    });
    return;
  }

  const ciPath = parsed.flags["ci"] as string | undefined;
  if (ciPath) {
    const resolvedPath = resolve(ciPath);
    if (!existsSync(resolvedPath)) {
      exitWithError(
        {
          title: "CI results not found",
          message: `SARIF file not found at: ${resolvedPath}`,
          hint: "Pass --ci with a valid SARIF file path or remove the flag.",
          code: "ERR_SARIF_NOT_FOUND",
        },
        2,
      );
    }
  }

  clack.intro("AlignTrue Onboard");
  console.log("");

  try {
    // Analyze git history
    const spinner = createManagedSpinner();
    spinner.start("Analyzing recent work...");

    const gitAnalysis = analyzeGitHistory();

    // Parse CI results if provided
    let ciResults: { failedChecks: string[]; warnings: string[] } | undefined;
    if (ciPath) {
      ciResults = parseSARIF(ciPath);
    }

    spinner.stop("Analysis complete");

    // Generate checklist
    const checklist = generateChecklist(gitAnalysis, ciResults);

    // Add drift integration (team mode only)
    const driftInfo = await getDriftInfo(
      parsed.flags["config"] as string | undefined,
    );
    if (driftInfo && driftInfo.hasDrift) {
      checklist.push({
        status: "warning",
        message: `Team drift detected (${driftInfo.driftCount} source${driftInfo.driftCount > 1 ? "s" : ""})`,
        details: [
          `Categories: ${driftInfo.categories.join(", ")}`,
          "Sources have drifted from allowed versions",
        ],
        command: "aligntrue drift",
      });
    }

    // Add plugs integration
    const plugsInfo = await getPlugsInfo(
      parsed.flags["config"] as string | undefined,
    );
    if (plugsInfo && plugsInfo.hasUnresolvedPlugs) {
      checklist.push({
        status: "warning",
        message: `Resolve ${plugsInfo.unresolvedCount} unresolved plug${plugsInfo.unresolvedCount > 1 ? "s" : ""}`,
        details: plugsInfo.unresolvedKeys
          .slice(0, 5)
          .map(
            (key) => `  - ${key}: Add fill in .aligntrue/rules/ or align YAML`,
          ),
        command: "aligntrue plugs list",
      });
    }

    // Display checklist
    displayChecklist(checklist, gitAnalysis);

    clack.outro("Ready to get started!");
    console.log("");

    process.exit(0);
  } catch (error) {
    clack.cancel("Onboarding analysis failed");
    exitWithError({
      title: "Onboard command failed",
      message: error instanceof Error ? error.message : String(error),
      code: "ERR_ONBOARD_FAILED",
    });
  }
}
