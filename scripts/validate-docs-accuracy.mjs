#!/usr/bin/env node

/**
 * Documentation Accuracy Validator
 *
 * Validates that documentation matches implementation reality to prevent drift.
 * Checks:
 * - Node.js version requirements consistency
 * - CLI command count accuracy
 * - Exporter count accuracy
 * - Absence of specific performance marketing claims (we use catastrophic regression detection)
 *
 * Exit codes:
 * - 0: All validations passed
 * - 1: One or more validations failed
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

// ANSI color codes for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  bold: "\x1b[1m",
};

const errors = [];

/**
 * Log error with formatting
 */
function logError(message, details = {}) {
  errors.push({ message, details });
  console.error(
    `${colors.red}${colors.bold}✗${colors.reset} ${colors.red}${message}${colors.reset}`,
  );
  if (details.expected !== undefined) {
    console.error(
      `  Expected: ${colors.green}${details.expected}${colors.reset}`,
    );
  }
  if (details.actual !== undefined) {
    console.error(`  Actual:   ${colors.red}${details.actual}${colors.reset}`);
  }
  if (details.files && details.files.length > 0) {
    console.error(`  Files to update:`);
    details.files.forEach((file) => console.error(`    - ${file}`));
  }
  console.error("");
}

/**
 * Log success with formatting
 */
function logSuccess(message) {
  console.log(
    `${colors.green}${colors.bold}✓${colors.reset} ${colors.green}${message}${colors.reset}`,
  );
}

/**
 * Log section header
 */
function logSection(title) {
  console.log(`\n${colors.blue}${colors.bold}${title}${colors.reset}`);
  console.log(`${colors.blue}${"=".repeat(title.length)}${colors.reset}\n`);
}

/**
 * Validate Node.js version consistency
 */
function validateNodeVersion() {
  logSection("Validating Node.js version requirements");

  // Read version from package.json
  const packageJsonPath = join(rootDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const expectedNodeVersion = packageJson.engines.node;

  console.log(
    `Source of truth: package.json engines.node = "${expectedNodeVersion}"\n`,
  );

  // Extract major version (e.g., ">=22" -> "22")
  const majorVersion = expectedNodeVersion.match(/\d+/)?.[0];
  if (!majorVersion) {
    logError("Could not parse Node version from package.json", {
      actual: expectedNodeVersion,
    });
    return;
  }

  // Files to check
  const docsFiles = [
    "apps/docs/content/00-getting-started/00-quickstart.mdx",
    "apps/docs/content/00-getting-started/03-faq.mdx",
    "apps/docs/content/04-reference/features.md",
    "apps/docs/content/05-troubleshooting/index.mdx",
    "apps/docs/content/06-contributing/creating-aligns.md",
    "apps/docs/content/06-contributing/getting-started.md",
    "apps/docs/content/08-development/setup.mdx",
    ".cursor/rules/global.mdc",
  ];

  const wrongVersionFiles = [];

  for (const file of docsFiles) {
    const filePath = join(rootDir, file);
    try {
      const content = readFileSync(filePath, "utf8");

      // Look for Node version mentions lower than required
      // Patterns: "Node.js 19-", "Node 19-", "node19", ">=19", etc.
      const wrongPatterns = [
        /Node\.js\s+(1[0-9])\+/gi, // Node.js 10+ through 19+
        /Node\s+(1[0-9])\+/gi, // Node 10+ through 19+
        /node(1[0-9])(?![0-9])/gi, // node10 through node19
        />=\s*(1[0-9])(?!\d)/g, // >=10 through >=19
        /node:\s*["'](1[0-9])/gi, // node: "10" through node: "19"
      ];

      for (const pattern of wrongPatterns) {
        if (pattern.test(content)) {
          wrongVersionFiles.push(file);
          break;
        }
      }
    } catch (err) {
      // File might not exist, skip
      continue;
    }
  }

  if (wrongVersionFiles.length > 0) {
    logError("Node.js version mismatch in documentation", {
      expected: `Node ${majorVersion}+ (from package.json)`,
      actual: `Node version lower than ${majorVersion} found in some files`,
      files: wrongVersionFiles,
    });
  } else {
    logSuccess(`All documentation uses Node ${majorVersion}+`);
  }
}

/**
 * Validate CLI command count
 */
function validateCommandCount() {
  logSection("Validating CLI command count");

  // Read CLI index to count commands
  const cliIndexPath = join(rootDir, "packages/cli/src/index.ts");
  const cliContent = readFileSync(cliIndexPath, "utf8");

  // Count commands in COMMANDS Map (e.g., ["init", init],)
  const commandMatches = cliContent.match(/\["(\w+)",\s*\w+\]/g);
  const actualCommandCount = commandMatches ? commandMatches.length : 0;

  console.log(`Source of truth: packages/cli/src/index.ts\n`);
  console.log(`Commands found: ${actualCommandCount}\n`);

  // Check features.md
  const featuresPath = join(
    rootDir,
    "apps/docs/content/04-reference/features.md",
  );
  const featuresContent = readFileSync(featuresPath, "utf8");

  // Look for "## CLI (XX commands)"
  const commandCountMatch = featuresContent.match(/## CLI \((\d+) commands?\)/);
  const documentedCount = commandCountMatch
    ? parseInt(commandCountMatch[1], 10)
    : null;

  if (documentedCount === null) {
    logError("Could not find CLI command count in features.md", {
      expected: `### CLI (${actualCommandCount} commands)`,
      files: ["apps/docs/content/04-reference/features.md"],
    });
  } else if (documentedCount !== actualCommandCount) {
    logError("CLI command count mismatch", {
      expected: `${actualCommandCount} commands (actual implementation)`,
      actual: `${documentedCount} commands (documented)`,
      files: ["apps/docs/content/04-reference/features.md"],
    });
  } else {
    logSuccess(`CLI command count is accurate: ${actualCommandCount} commands`);
  }
}

/**
 * Validate exporter count
 */
function validateExporterCount() {
  logSection("Validating exporter count");

  // Count exporter directories
  const exportersPath = join(rootDir, "packages/exporters/src");
  const entries = readdirSync(exportersPath);

  // Filter to only directories, excluding base, utils, mcp-transformers, and files
  const exporterDirs = entries.filter((entry) => {
    const fullPath = join(exportersPath, entry);
    const isDir = statSync(fullPath).isDirectory();
    const isExporter = !["base", "utils", "mcp-transformers"].includes(entry);
    return isDir && isExporter;
  });

  const actualExporterCount = exporterDirs.length;

  console.log(`Source of truth: packages/exporters/src/ directory count\n`);
  console.log(`Exporters found: ${actualExporterCount}\n`);

  const filesToCheck = [
    {
      path: "apps/docs/content/index.mdx",
      pattern: /(\d+)\s+exporters/i,
    },
    {
      path: "apps/docs/content/04-reference/agent-support.mdx",
      pattern: /\*\*(\d+)\s+total\s+exporters\*\*/i,
    },
  ];

  const wrongFiles = [];

  for (const { path, pattern } of filesToCheck) {
    const filePath = join(rootDir, path);
    const content = readFileSync(filePath, "utf8");
    const match = content.match(pattern);

    if (match) {
      const documentedCount = parseInt(match[1], 10);
      if (documentedCount !== actualExporterCount) {
        wrongFiles.push({
          file: path,
          documented: documentedCount,
        });
      }
    }
  }

  if (wrongFiles.length > 0) {
    logError("Exporter count mismatch", {
      expected: `${actualExporterCount} exporters (actual count)`,
      actual: wrongFiles.map((f) => `${f.documented} in ${f.file}`).join(", "),
      files: wrongFiles.map((f) => f.file),
    });
  } else {
    logSuccess(`Exporter count is accurate: ${actualExporterCount} exporters`);
  }
}

/**
 * Validate that no performance marketing claims exist
 *
 * We use catastrophic regression detection (5x thresholds) for CI reliability,
 * not tight marketing claims. This check ensures we haven't re-added specific
 * performance numbers as marketing material.
 */
function validateNoPerformanceMarketingClaims() {
  logSection("Validating no performance marketing claims");

  // Check features.md doesn't have specific performance claims
  const featuresPath = join(
    rootDir,
    "apps/docs/content/04-reference/features.md",
  );
  const featuresContent = readFileSync(featuresPath, "utf8");

  // Look for any detailed performance claims (specific ms timings)
  const performanceClaimPatterns = [
    /Fast `--help`[^)]*\(measured performance:/i,
    /completes? in (?:<|under|within)\s*\d+\s*(?:ms|milliseconds)/i,
    /~\d+ms/i,
  ];

  const foundClaims = [];
  for (const pattern of performanceClaimPatterns) {
    if (pattern.test(featuresContent)) {
      foundClaims.push(pattern.toString());
    }
  }

  if (foundClaims.length > 0) {
    logError("Found specific performance marketing claims in features.md", {
      actual:
        "Performance tests use catastrophic regression detection, not marketing claims",
      files: ["apps/docs/content/04-reference/features.md"],
    });
  } else {
    logSuccess(
      "No performance marketing claims found (catastrophic regression detection only)",
    );
  }
}

/**
 * Validate platform coverage documentation matches CI configuration
 */
function validatePlatformCoverage() {
  logSection("Validating platform coverage documentation");

  // Read CI workflow to extract actual platform matrix
  const ciWorkflowPath = join(rootDir, ".github/workflows/ci.yml");
  const ciContent = readFileSync(ciWorkflowPath, "utf8");

  console.log(`Source of truth: .github/workflows/ci.yml\n`);

  // Extract platforms from matrix.include
  const platformMatches = ciContent.match(/- os: ([\w-]+)/g);
  const platforms = platformMatches
    ? [...new Set(platformMatches.map((m) => m.replace("- os: ", "")))]
    : [];

  // Extract Node versions from matrix.include
  const nodeMatches = ciContent.match(/node: ["'](\d+)["']/g);
  const nodeVersions = nodeMatches
    ? [...new Set(nodeMatches.map((m) => m.match(/\d+/)[0]))]
    : [];

  console.log(`Platforms found: ${platforms.join(", ")}`);
  console.log(`Node versions found: ${nodeVersions.join(", ")}\n`);

  // Check ci-failures.md documents all platforms
  const ciFailuresPath = join(
    rootDir,
    "apps/docs/content/08-development/ci-failures.md",
  );
  const ciFailuresContent = readFileSync(ciFailuresPath, "utf8");

  const wrongFiles = [];

  // Check for platform mentions
  const expectedPlatforms = {
    "ubuntu-latest": ["Ubuntu", "Linux"],
    "macos-latest": ["macOS", "Mac"],
    "windows-latest": ["Windows"],
  };

  for (const platform of platforms) {
    const aliases = expectedPlatforms[platform] || [platform];
    const hasMention = aliases.some((alias) =>
      ciFailuresContent.includes(alias),
    );

    if (!hasMention) {
      wrongFiles.push({
        file: "apps/docs/content/08-development/ci-failures.md",
        issue: `Missing documentation for platform: ${platform}`,
      });
    }
  }

  // Check for Node version mentions in platform coverage section
  for (const version of nodeVersions) {
    const hasNodeMention = ciFailuresContent.includes(`Node ${version}`);
    if (!hasNodeMention) {
      wrongFiles.push({
        file: "apps/docs/content/08-development/ci-failures.md",
        issue: `Missing documentation for Node version: ${version}`,
      });
    }
  }

  // Check that platform coverage section exists
  if (!ciFailuresContent.includes("### Platform coverage")) {
    wrongFiles.push({
      file: "apps/docs/content/08-development/ci-failures.md",
      issue: "Missing '### Platform coverage' section",
    });
  }

  if (wrongFiles.length > 0) {
    const issues = wrongFiles.map((f) => f.issue).join(", ");
    logError("Platform coverage documentation incomplete", {
      expected: `All platforms (${platforms.join(", ")}) and Node versions (${nodeVersions.join(", ")}) documented`,
      actual: issues,
      files: [...new Set(wrongFiles.map((f) => f.file))],
    });
  } else {
    logSuccess(
      `Platform coverage documentation is accurate: ${platforms.length} platforms, ${nodeVersions.length} Node versions`,
    );
  }
}

/**
 * Main validation runner
 */
function main() {
  console.log(
    `${colors.bold}Documentation Accuracy Validator${colors.reset}\n`,
  );
  console.log("Checking that documentation matches implementation...\n");

  validateNodeVersion();
  validateCommandCount();
  validateExporterCount();
  validateNoPerformanceMarketingClaims();
  validatePlatformCoverage();

  // Summary
  console.log(`\n${colors.bold}Summary${colors.reset}`);
  console.log(`${"=".repeat(50)}\n`);

  if (errors.length === 0) {
    console.log(
      `${colors.green}${colors.bold}✓ All validations passed!${colors.reset}\n`,
    );
    process.exit(0);
  } else {
    console.log(
      `${colors.red}${colors.bold}✗ ${errors.length} validation(s) failed${colors.reset}\n`,
    );
    console.log(
      `${colors.yellow}Fix the issues above and run again.${colors.reset}`,
    );
    console.log(
      `${colors.yellow}Remember: Code/config is the source of truth, not docs.${colors.reset}\n`,
    );
    process.exit(1);
  }
}

main();
