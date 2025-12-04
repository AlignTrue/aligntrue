/**
 * Drift command - Detect drift between lockfile and allowed sources
 *
 * Enables:
 * - Team alignment monitoring (upstream changes)
 * - Severity remapping policy validation
 * - CI integration with --gates flag
 *
 * Strategy:
 * - Compare lockfile hashes against allowed sources
 * - Categorize drift types: upstream, severity_remap, lockfile, agent_file
 * - Non-zero exit only with --gates flag (CI-friendly)
 * - Multiple output formats: human, JSON, SARIF
 */

import {
  parseCommonArgs,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import {
  detectDriftForConfig,
  type DriftCategory,
} from "@aligntrue/core/team/drift.js";

// Type for detectDriftForConfig return value
type DriftDetectionResult = {
  driftDetected: boolean;
  mode: string;
  lockfilePath: string;
  summary?: string | undefined;
  personalRulesCount?: number | undefined;
  drift: Array<{
    category: DriftCategory;
    ruleId: string;
    description: string;
    suggestion?: string | undefined;
    lockfile_hash?: string | undefined;
    expected_hash?: string | undefined;
  }>;
};

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
    flag: "--post-sync",
    hasValue: false,
    description: "Ignore lockfile drift (useful after automated sync)",
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
  lockfile        Rules changed since last lockfile generation
  agent_file      Agent files modified after IR (team mode)
  upstream        Rule content changed in allowed sources
  severity_remap  Severity remapping policy violations

COMPARISON
  Use 'aligntrue check --ci' to validate schema/lockfile consistency.
  Use 'aligntrue drift --gates' to detect source or agent file drift (team mode).

EXAMPLES
  # Check for drift (human readable)
  aligntrue drift

  # CI mode - fail on drift
  aligntrue drift --gates

  # JSON output for tools
  aligntrue drift --json

EXIT CODES
  0  No drift detected or --gates not used
  2  Drift detected with --gates flag
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
    typeof parsedArgs.flags["config"] === "string"
      ? parsedArgs.flags["config"]
      : ".aligntrue/config.yaml";
  const config = await loadConfigWithValidation(configPath);

  // Must be in team mode
  if (config.mode !== "team") {
    console.error(
      "Drift detection requires team mode. Run: aligntrue team enable",
    );
    process.exit(1);
  }

  // Detect drift (add path properties for drift detection)
  const configWithPaths = {
    ...config,
    rootDir: process.cwd(),
    lockfilePath: ".aligntrue/lock.json",
  };
  const ignoreLockfileDrift = Boolean(parsedArgs.flags["post-sync"]);
  const driftResults = await detectDriftForConfig(
    configWithPaths,
    ignoreLockfileDrift,
  );

  // Output results based on format
  const gatesEnabled = Boolean(parsedArgs.flags["gates"]);
  if (parsedArgs.flags["json"]) {
    outputJson(driftResults);
  } else if (parsedArgs.flags["sarif"]) {
    outputSarif(driftResults, gatesEnabled);
  } else {
    outputHuman(driftResults);
  }

  // Exit with error code if --gates flag used and drift detected
  if (gatesEnabled && driftResults.driftDetected) {
    process.exit(2);
  }
}

/**
 * Output results in human-readable format
 */
function outputHuman(results: DriftDetectionResult): void {
  if (!results.driftDetected) {
    console.log("No drift detected");
    console.log(`Mode: ${results.mode}`);
    return;
  }

  console.log("Drift Detection Report");
  console.log("======================");
  console.log(`Mode: ${results.mode}`);

  // Group by category
  const byCategory = results.drift.reduce(
    (
      acc: Record<string, DriftDetectionResult["drift"]>,
      item: DriftDetectionResult["drift"][0],
    ) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category]!.push(item);
      return acc;
    },
    {} as Record<string, DriftDetectionResult["drift"]>,
  );

  // Output each category
  Object.entries(byCategory).forEach(([category, items]) => {
    const upperCategory = category.toUpperCase().replace("_", " ");
    const itemArray = items as DriftDetectionResult["drift"];
    console.log(`\n${upperCategory} DRIFT:`);

    itemArray.forEach((item: DriftDetectionResult["drift"][0]) => {
      console.log(`  ${item.ruleId}`);

      // For upstream drift, show hashes
      if (
        category === "upstream" &&
        (item.lockfile_hash || item.expected_hash)
      ) {
        if (item.lockfile_hash) {
          console.log(`    Lockfile: ${item.lockfile_hash.slice(0, 12)}...`);
        }
        if (item.expected_hash) {
          console.log(`    Allowed: ${item.expected_hash.slice(0, 12)}...`);
        }
      }

      console.log(`    ${item.description}`);
      if (item.suggestion) {
        console.log(`    Suggestion: ${item.suggestion}`);
      }
    });
  });

  console.log("");
  console.log(`Lockfile: ${results.lockfilePath}`);
  console.log(`Findings: ${results.drift.length}`);

  // Show personal rules info if present
  if (
    results.personalRulesCount !== undefined &&
    results.personalRulesCount > 0
  ) {
    console.log("");
    console.log("PERSONAL RULES (not validated):");
    console.log(`  ${results.personalRulesCount} personal sections`);
    console.log("  Personal rules do not require team approval");
  }

  console.log("");
  console.log("Tip: Use '--json' or '--sarif' for machine-readable output.");
  console.log("Tip: Add '--gates' to fail CI when drift is detected.");
}

/**
 * Output results in JSON format
 */
function outputJson(results: DriftDetectionResult): void {
  const output = {
    mode: results.mode,
    has_drift: results.driftDetected,
    lockfile_path: results.lockfilePath,
    findings: results.drift,
    summary: {
      total: results.drift.length,
      by_category: results.drift.reduce(
        (
          acc: Record<string, number>,
          item: DriftDetectionResult["drift"][0],
        ) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        },
        {
          lockfile: 0,
          agent_file: 0,
          upstream: 0,
          overlay: 0,
          result: 0,
          severity_remap: 0,
        } as Record<string, number>,
      ),
    },
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output results in SARIF format
 */
function outputSarif(
  results: DriftDetectionResult,
  gatesEnabled: boolean,
): void {
  const rules = results.drift.reduce(
    (
      acc: {
        id: string;
        shortDescription: { text: string };
        fullDescription: { text: string };
      }[],
      item: DriftDetectionResult["drift"][0],
    ) => {
      const ruleId = `aligntrue/${item.category}-drift`;
      if (!acc.find((r) => r.id === ruleId)) {
        acc.push({
          id: ruleId,
          shortDescription: {
            text: `${item.category} drift detected`,
          },
          fullDescription: {
            text: `Detected drift in ${item.category} category`,
          },
        });
      }
      return acc;
    },
    [],
  );

  const sarif = {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "AlignTrue Drift Detection",
            version: "1.0.0",
            informationUri: "https://github.com/AlignTrue/aligntrue",
            rules,
          },
        },
        results: results.drift.map(
          (item: DriftDetectionResult["drift"][0]) => ({
            ruleId: `aligntrue/${item.category}-drift`,
            level: gatesEnabled ? "error" : "warning",
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
          }),
        ),
      },
    ],
  };

  console.log(JSON.stringify(sarif, null, 2));
}
