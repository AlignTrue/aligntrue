#!/usr/bin/env node

/**
 * Documentation Accuracy Validator
 *
 * Validates that documentation matches implementation reality to prevent drift.
 * Checks:
 * - Node.js version requirements consistency
 * - CLI command count accuracy
 * - Exporter count accuracy
 * - Performance threshold claims
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
const warnings = [];

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
    "apps/docs/content/06-contributing/creating-packs.md",
    "apps/docs/content/06-contributing/getting-started.md",
    "apps/docs/content/08-development/setup.mdx",
    ".cursor/rules/global.mdc",
  ];

  const wrongVersionFiles = [];

  for (const file of docsFiles) {
    const filePath = join(rootDir, file);
    try {
      const content = readFileSync(filePath, "utf8");

      // Look for Node version mentions
      // Patterns: "Node.js 20+", "Node 20+", "node20", ">=20", etc.
      const wrongPatterns = [
        /Node\.js\s+20\+/gi,
        /Node\s+20\+/gi,
        /node20/gi,
        />=\s*20(?!\d)/g, // >=20 but not >=200
        /node:\s*["']20/gi,
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
      actual: "Node 20+ found in some files",
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

  // Count command dispatch statements (if (command === "..."))
  const commandMatches = cliContent.match(/if \(command === ["'](\w+)["']\)/g);
  const actualCommandCount = commandMatches ? commandMatches.length : 0;

  console.log(`Source of truth: packages/cli/src/index.ts\n`);
  console.log(`Commands found: ${actualCommandCount}\n`);

  // Check features.md
  const featuresPath = join(
    rootDir,
    "apps/docs/content/04-reference/features.md",
  );
  const featuresContent = readFileSync(featuresPath, "utf8");

  // Look for "### CLI (XX commands)"
  const commandCountMatch = featuresContent.match(
    /### CLI \((\d+) commands?\)/,
  );
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

  // Filter to only directories, excluding base, utils, and files
  const exporterDirs = entries.filter((entry) => {
    const fullPath = join(exportersPath, entry);
    const isDir = statSync(fullPath).isDirectory();
    const isExporter = !["base", "utils"].includes(entry);
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
      path: "apps/docs/content/04-reference/agent-support.md",
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
 * Validate performance threshold claims
 */
function validatePerformanceThresholds() {
  logSection("Validating performance threshold claims");

  // Read thresholds from test file
  const testPath = join(
    rootDir,
    "packages/cli/tests/integration/performance.test.ts",
  );
  const testContent = readFileSync(testPath, "utf8");

  // Extract thresholds
  const avgThresholdMatch = testContent.match(
    /avgThreshold\s*=\s*process\.platform\s*===\s*["']win32["']\s*\?\s*(\d+)\s*:\s*(\d+)/,
  );

  if (!avgThresholdMatch) {
    logError("Could not parse performance thresholds from test file", {
      files: ["packages/cli/tests/integration/performance.test.ts"],
    });
    return;
  }

  const windowsThreshold = avgThresholdMatch[1];
  const ubuntuThreshold = avgThresholdMatch[2];

  console.log(
    `Source of truth: packages/cli/tests/integration/performance.test.ts\n`,
  );
  console.log(
    `Thresholds: ~${ubuntuThreshold}ms Ubuntu, ~${windowsThreshold}ms Windows\n`,
  );

  // Check features.md
  const featuresPath = join(
    rootDir,
    "apps/docs/content/04-reference/features.md",
  );
  const featuresContent = readFileSync(featuresPath, "utf8");

  // Look for performance claim
  const performanceMatch = featuresContent.match(
    /Fast `--help`[^)]*\(measured performance:[^)]*~(\d+)ms[^)]*Ubuntu[^)]*~(\d+)ms[^)]*Windows/i,
  );

  if (!performanceMatch) {
    logError("Could not find performance claim in features.md", {
      expected: `~${ubuntuThreshold}ms Ubuntu, ~${windowsThreshold}ms Windows`,
      files: ["apps/docs/content/04-reference/features.md"],
    });
  } else {
    const docUbuntu = performanceMatch[1];
    const docWindows = performanceMatch[2];

    if (docUbuntu !== ubuntuThreshold || docWindows !== windowsThreshold) {
      logError("Performance threshold mismatch", {
        expected: `~${ubuntuThreshold}ms Ubuntu, ~${windowsThreshold}ms Windows (from tests)`,
        actual: `~${docUbuntu}ms Ubuntu, ~${docWindows}ms Windows (documented)`,
        files: ["apps/docs/content/04-reference/features.md"],
      });
    } else {
      logSuccess(
        `Performance thresholds are accurate: ~${ubuntuThreshold}ms Ubuntu, ~${windowsThreshold}ms Windows`,
      );
    }
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
  validatePerformanceThresholds();

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
