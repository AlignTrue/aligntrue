/**
 * Drift command - Detect drift between lockfile and allowed sources
 *
 * Enables:
 * - Team alignment monitoring (upstream changes)
 * - Vendorized pack integrity checking
 * - Severity remapping policy validation
 * - CI integration with --gates flag
 *
 * Strategy:
 * - Compare lockfile hashes against allowed sources
 * - Categorize drift types: upstream, severity_remap, vendorized
 * - Non-zero exit only with --gates flag (CI-friendly)
 * - Multiple output formats: human, JSON, SARIF
 */

import * as clack from "@clack/prompts";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import { detectDriftForConfig } from "@aligntrue/core";

/**
 * Argument definitions for drift command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--gates",
    hasValue: false,
    description: "Enable strict mode (exit non-zero on drift detection)",
  },
  {
    flag: "--json",
    hasValue: false,
    description: "Output results in JSON format",
  },
  {
    flag: "--sarif",
    hasValue: false,
    description: "Output results in SARIF format for CI tools",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Path to config file (default: .aligntrue/config.yaml)",
  },
];

/**
 * Help text for drift command
 */
const HELP_TEXT = `
aligntrue drift - Detect drift between lockfile and allowed sources

DESCRIPTION
  Monitors team alignment by detecting drift between your lockfile and allowed sources.
  Useful for CI pipelines and manual drift checking.

USAGE
  aligntrue drift [options]

OPTIONS
  --gates          Enable strict mode (exit non-zero on drift detection)
  --json           Output results in JSON format
  --sarif          Output results in SARIF format for CI tools
  --config <path>  Path to config file (default: .aligntrue/config.yaml)
  --help, -h       Show this help message

DRIFT TYPES
  upstream        Rule content changed in allowed sources
  severity_remap  Severity remapping policy violations
  vendorized      Vendored pack integrity issues

EXAMPLES
  # Check for drift (human readable)
  aligntrue drift

  # CI mode - fail on drift
  aligntrue drift --gates

  # JSON output for tools
  aligntrue drift --json

EXIT CODES
  0  No drift detected or --gates not used
  2  Drift detected (only with --gates flag)
`;

/**
 * Main drift command implementation
 */
export async function drift(args: string[]): Promise<void> {
  // Parse arguments
  const parsedArgs = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (parsedArgs.help) {
    console.log(HELP_TEXT);
    return;
  }

  // Load and validate config
  const configPath =
    typeof parsedArgs.flags["--config"] === "string"
      ? parsedArgs.flags["--config"]
      : ".aligntrue/config.yaml";
  const config = await loadConfigWithValidation(configPath);

  // Must be in team mode
  if (config.mode !== "team") {
    console.error(
      "Drift detection requires team mode. Run: aligntrue team enable",
    );
    process.exit(1);
  }

  // Detect drift
  const driftResults = await detectDriftForConfig(config);

  // Record telemetry
  await recordEvent({
    command_name: "drift",
    align_hashes_used: [], // No specific hashes for drift command
  });

  // Output results based on format
  if (parsedArgs.flags["--json"]) {
    outputJson(driftResults);
  } else if (parsedArgs.flags["--sarif"]) {
    outputSarif(driftResults);
  } else {
    outputHuman(driftResults);
  }

  // Exit with error code if --gates flag used and drift detected
  if (parsedArgs.flags["--gates"] && driftResults.driftDetected) {
    process.exit(2);
  }
}

/**
 * Output results in human-readable format
 */
function outputHuman(results: any): void {
  if (!results.driftDetected) {
    console.log("No drift detected");
    console.log(`Mode: ${results.mode}`);
    return;
  }

  console.log("Drift Detection Report");
  console.log("======================");

  // Group by category
  const byCategory = results.drift.reduce((acc: any, item: any) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Output each category
  Object.entries(byCategory).forEach(([category, items]) => {
    const upperCategory = category.toUpperCase().replace("_", " ");
    const itemArray = items as any[];
    console.log(`\n${upperCategory} DRIFT (${itemArray.length} items):`);

    itemArray.forEach((item: any) => {
      console.log(`  • ${item.ruleId}: ${item.description}`);
      if (item.suggestion) {
        console.log(`    Suggestion: ${item.suggestion}`);
      }
    });
  });

  if (results.summary && results.summary.trim()) {
    console.log(`\nSummary: ${results.summary}`);
  }
}

/**
 * Output results in JSON format
 */
function outputJson(results: any): void {
  console.log(
    JSON.stringify(
      {
        driftDetected: results.driftDetected,
        mode: results.mode,
        lockfilePath: results.lockfilePath,
        summary: results.summary,
        driftByCategory: results.drift.reduce((acc: any, item: any) => {
          if (!acc[item.category]) acc[item.category] = [];
          acc[item.category].push({
            ruleId: item.ruleId,
            description: item.description,
            suggestion: item.suggestion,
          });
          return acc;
        }, {}),
      },
      null,
      2,
    ),
  );
}

/**
 * Output results in SARIF format
 */
function outputSarif(results: any): void {
  const sarif = {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "aligntrue-drift",
            fullName: "AlignTrue Drift Detection",
            version: "1.0.0",
            informationUri: "https://github.com/AlignTrue/aligntrue",
          },
        },
        results: results.drift.map((item: any) => ({
          ruleId: `drift-${item.category}`,
          level: results.gatesEnabled ? "error" : "warning",
          message: {
            text: item.description,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: results.lockfilePath,
                },
              },
            },
          ],
        })),
      },
    ],
  };

  console.log(JSON.stringify(sarif, null, 2));
}
