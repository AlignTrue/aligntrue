#!/usr/bin/env node
/**
 * Comprehensive test runner - executes all 8 layers
 * Usage: tsx run-all-layers.ts
 */

import { execSync, type ExecException } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
  mkdtempSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Clean up old test directories
 * Keeps last 3 test runs or directories newer than 24 hours
 */
function cleanupOldTestDirs(): void {
  try {
    const tmpDir = tmpdir();
    const entries = readdirSync(tmpDir);
    const testDirs = entries
      .filter(
        (name) => name.startsWith("aligntrue-test-") && name.endsWith("-"),
      )
      .map((name) => {
        const path = join(tmpDir, name);
        try {
          const stats = statSync(path);
          return {
            path,
            name,
            mtime: stats.mtimeMs,
          };
        } catch {
          return null;
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    // Sort by modification time (newest first)
    testDirs.sort((a, b) => b.mtime - a.mtime);

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    let deleted = 0;

    // Keep last 3, delete older than 24 hours
    testDirs.forEach((dir, index) => {
      const age = now - dir.mtime;
      if (index >= 3 && age > oneDayMs) {
        try {
          rmSync(dir.path, { recursive: true, force: true });
          deleted++;
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    if (deleted > 0) {
      console.log(
        `Cleaned up ${deleted} old test director${deleted === 1 ? "y" : "ies"}`,
      );
    }
  } catch {
    // Ignore cleanup errors - not critical
  }
}

const testDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));

console.log(`\n=== AlignTrue Comprehensive Testing ===`);
console.log(`Running all 8 layers`);
console.log(`Test directory: ${testDir}\n`);

// Clean up old test directories before starting
cleanupOldTestDirs();

// Create test directory
// mkdirSync(testDir, { recursive: true }); // mkdtempSync already creates the directory

// Set environment
process.env.TZ = "UTC";
process.env.NODE_ENV = "test";

console.log("Cloning repository...");
try {
  execSync(
    `git clone --quiet https://github.com/AlignTrue/aligntrue.git ${testDir}/repo`,
    {
      stdio: "pipe",
    },
  );
} catch {
  console.error("Failed to clone repository");
  process.exit(3);
}

const repoDir = join(testDir, "repo");
const commitHash = execSync("git rev-parse HEAD", {
  cwd: repoDir,
  encoding: "utf-8",
}).trim();

console.log(`Commit: ${commitHash}`);

console.log("Building CLI...");
try {
  execSync("pnpm --filter @aligntrue/cli build", {
    cwd: repoDir,
    stdio: "pipe",
  });
} catch {
  console.error("Failed to build CLI");
  process.exit(3);
}

const cliPath = join(repoDir, "packages/cli/dist/index.js");
process.env.PATH = `${join(repoDir, "packages/cli/dist")}:${process.env.PATH}`;

interface LayerResult {
  layer: number;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const layerNames = [
  "Smoke Tests",
  "Solo Golden Paths",
  "Team Golden Paths",
  "Command Coverage",
  "Statefulness",
  "Environment Matrix",
  "Error & UX",
  "Exploratory",
];

const results: LayerResult[] = [];
const startTime = Date.now();

try {
  for (let layer = 1; layer <= 8; layer++) {
    const layerStart = Date.now();
    const workspace = join(testDir, `workspace-layer-${layer}`);
    const logFile = join(testDir, `layer-${layer}-output.log`);

    mkdirSync(workspace, { recursive: true });

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Layer ${layer}: ${layerNames[layer - 1]}`);
    console.log("=".repeat(60));

    process.env.TEST_WORKSPACE = workspace;
    process.env.LOG_FILE = logFile;

    const layerScript = join(
      repoDir,
      `packages/cli/tests/comprehensive/layers/layer-${layer}-*.ts`,
    );

    let layerFile: string;
    try {
      const layerFiles = execSync(`ls ${layerScript}`, { encoding: "utf-8" })
        .trim()
        .split("\n");
      layerFile = layerFiles[0];
    } catch {
      console.error(`Layer ${layer} script not found`);
      results.push({
        layer,
        name: layerNames[layer - 1],
        passed: false,
        duration: Date.now() - layerStart,
        error: "Script not found",
      });
      continue;
    }

    try {
      execSync(`node --loader tsx ${layerFile}`, {
        cwd: workspace,
        stdio: "inherit",
        env: {
          ...process.env,
          ALIGNTRUE_CLI: cliPath,
        },
      });

      results.push({
        layer,
        name: layerNames[layer - 1],
        passed: true,
        duration: Date.now() - layerStart,
      });

      console.log(`\n✓ Layer ${layer} completed`);
    } catch (err) {
      const execErr = err as ExecException;
      results.push({
        layer,
        name: layerNames[layer - 1],
        passed: false,
        duration: Date.now() - layerStart,
        error: `Exit code: ${execErr.status || 1}`,
      });

      console.error(`\n✗ Layer ${layer} failed`);
    }
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("COMPREHENSIVE TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log(`\nCommit: ${commitHash}`);
  console.log(`Duration: ${Math.round(totalDuration / 1000)}s`);
  console.log(`Total layers: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  console.log("\nLayer Results:");
  for (const result of results) {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    const duration = Math.round(result.duration / 1000);
    console.log(
      `  ${status} Layer ${result.layer}: ${result.name} (${duration}s)`,
    );
    if (result.error) {
      console.log(`       ${result.error}`);
    }
  }

  // Generate markdown report
  const reportMd = generateMarkdownReport(commitHash, results, totalDuration);

  const internalDocsDir = join(repoDir, ".internal_docs");
  mkdirSync(internalDocsDir, { recursive: true });

  const reportPath = join(internalDocsDir, "TEST_LOG.md");
  let existingContent = "";
  try {
    existingContent = readFileSync(reportPath, "utf-8");
  } catch (error) {
    const isError = error instanceof Error;
    if (!(isError && "code" in error && error.code === "ENOENT")) {
      // re-throw errors other than file not found
      throw error;
    }
  }

  writeFileSync(reportPath, reportMd + "\n\n" + existingContent);

  console.log(`\nReport saved: ${reportPath}`);

  // Cleanup current test directory
  console.log("\nCleaning up...");
  // execSync(`rm -rf ${testDir}`); // This will be handled by finally block

  // Clean up old test directories again after test run
  cleanupOldTestDirs();

  process.exit(failed > 0 ? 1 : 0);
} finally {
  rmSync(testDir, { recursive: true, force: true });
}

function generateMarkdownReport(
  commit: string,
  results: LayerResult[],
  duration: number,
): string {
  const date = new Date().toLocaleDateString();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  let md = `## Test Run ${date}\n\n`;
  md += `**Commit:** ${commit}\n`;
  md += `**Scope:** Comprehensive (all 8 layers)\n`;
  md += `**Duration:** ~${Math.round(duration / 60000)} minutes\n\n`;
  md += `**Scenarios Executed:**\n\n`;

  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    md += `- ${icon} Layer ${result.layer}: ${result.name}\n`;
  }

  md += `\n**Summary:**\n\n`;
  md += `- Total layers: ${results.length}\n`;
  md += `- Passed: ${passed}\n`;
  md += `- Failed: ${failed}\n`;
  md += `- Success rate: ${Math.round((passed / results.length) * 100)}%\n\n`;

  if (failed > 0) {
    md += `**Issues Found:**\n\n`;
    for (const result of results.filter((r) => !r.passed)) {
      md += `- Layer ${result.layer} (${result.name}): ${result.error || "Failed"}\n`;
    }
    md += `\n`;
  }

  md += `**Gaps for Next Run:**\n\n`;
  md += `- Review failed layers and add specific test cases\n`;
  md += `- Expand coverage in areas with low test count\n`;

  return md;
}
