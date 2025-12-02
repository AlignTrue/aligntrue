#!/usr/bin/env node
/**
 * Simplified Comprehensive Test Runner (Local Workspace)
 *
 * Executes all 8 CLI test layers using the local workspace build.
 * Faster and more reliable than the remote runner (no cloning/building).
 *
 * Usage: tsx run-layers-local.ts
 *
 * Features:
 * - Tests run in isolated /tmp/ directories
 * - Uses local workspace's built CLI
 * - No network dependencies
 * - Clear safety guards to prevent workspace corruption
 * - Fast execution (seconds vs minutes)
 * - Detailed reporting
 */

import { execSync, type ExecException } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  existsSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { globSync } from "glob";

interface LayerResult {
  layer: number;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  output?: string;
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

// Get workspace root by going up from this file
const currentDir = new URL(import.meta.url).pathname;
const cliDir = resolve(currentDir, "../../../");
const workspaceRoot = resolve(cliDir, "../../");
const cliPath = resolve(cliDir, "dist/index.js");
const tsxLoaderPath = resolve(
  workspaceRoot,
  "node_modules/tsx/dist/esm/index.mjs",
);

console.log(`\n${"=".repeat(60)}`);
console.log("AlignTrue Comprehensive Testing (Local Workspace)");
console.log("=".repeat(60));
console.log(`Workspace: ${workspaceRoot}`);
console.log(`CLI path: ${cliPath}`);
console.log(`Running all 8 layers\n`);

// Verify CLI is built
if (!existsSync(cliPath)) {
  console.error(
    `ERROR: CLI not built. Run 'pnpm build' first or 'cd ${workspaceRoot} && pnpm build'`,
  );
  process.exit(1);
}

const testBaseDir = mkdtempSync(join(tmpdir(), "aligntrue-test-"));
const results: LayerResult[] = [];
const startTime = Date.now();

console.log(`Test directory: ${testBaseDir}\n`);

async function runLayer(layer: number): Promise<LayerResult> {
  const layerStart = Date.now();
  const layerName = layerNames[layer - 1];
  const workspace = join(testBaseDir, `layer-${layer}`);
  const logFile = join(testBaseDir, `layer-${layer}-output.log`);

  console.log(`${"─".repeat(60)}`);
  console.log(`Layer ${layer}: ${layerName}`);
  console.log(`${"─".repeat(60)}`);

  mkdirSync(workspace, { recursive: true });

  const layerScript = resolve(
    cliDir,
    `tests/comprehensive/layers/layer-${layer}-*.ts`,
  );

  let layerFile: string;
  try {
    // Use glob to find the layer file
    const matches = globSync(layerScript);
    if (matches.length === 0) {
      throw new Error("No matches found");
    }
    layerFile = matches[0];
  } catch {
    console.error(`ERROR: Layer ${layer} script not found`);
    return {
      layer,
      name: layerName,
      passed: false,
      duration: Date.now() - layerStart,
      error: "Script not found",
    };
  }

  const env = {
    ...process.env,
    TZ: "UTC",
    NODE_ENV: "test",
    ALIGNTRUE_CLI: cliPath,
    TEST_WORKSPACE: workspace,
    LOG_FILE: logFile,
  };

  try {
    const output = execSync(`node --import ${tsxLoaderPath} ${layerFile}`, {
      cwd: workspace,
      encoding: "utf-8",
      env,
      stdio: "pipe",
    });

    const duration = Date.now() - layerStart;
    console.log(`✓ Layer ${layer} passed (${duration}ms)\n`);

    return {
      layer,
      name: layerName,
      passed: true,
      duration,
      output,
    };
  } catch (err) {
    const execErr = err as ExecException;
    const duration = Date.now() - layerStart;
    const errorOutput =
      execErr.stdout?.toString() || execErr.stderr?.toString() || "";

    console.error(`✗ Layer ${layer} failed (${duration}ms)`);
    console.error(
      `Exit code: ${execErr.code || 1}\n${errorOutput.slice(0, 500)}\n`,
    );

    return {
      layer,
      name: layerName,
      passed: false,
      duration,
      error: `Exit code: ${execErr.status || 1}`,
      output: errorOutput,
    };
  }
}

async function main() {
  // Run all layers sequentially
  for (let layer = 1; layer <= 8; layer++) {
    const result = await runLayer(layer);
    results.push(result);
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary
  console.log(`${"=".repeat(60)}`);
  console.log("COMPREHENSIVE TEST SUMMARY");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log(`\nDuration: ${Math.round(totalDuration / 1000)}s`);
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
  const reportMd = generateMarkdownReport(results, totalDuration);

  const internalDocsDir = join(workspaceRoot, ".internal_docs");
  mkdirSync(internalDocsDir, { recursive: true });

  const reportPath = join(internalDocsDir, "TEST_LOG.md");
  let existingContent = "";
  try {
    existingContent = readFileSync(reportPath, "utf-8");
  } catch {
    // File doesn't exist, start fresh
  }

  const updatedContent = `${reportMd}\n\n---\n\n${existingContent}`;
  writeFileSync(reportPath, updatedContent);

  console.log(`\nReport written to: ${reportPath}`);
  console.log(`Test directory: ${testBaseDir}`);
  console.log(
    `(Keep this directory for debugging, or delete with: rm -rf ${testBaseDir})\n`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

function generateMarkdownReport(
  results: LayerResult[],
  totalDuration: number,
): string {
  const timestamp = new Date().toISOString();
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  let md = `# CLI Comprehensive Test Run\n\n`;
  md += `**Date:** ${timestamp}\n`;
  md += `**Method:** Local Workspace Testing\n`;
  md += `**Duration:** ${Math.round(totalDuration / 1000)}s\n`;
  md += `**Results:** ${passed}/${results.length} layers passed\n\n`;

  if (failed === 0) {
    md += `✓ All layers passed!\n\n`;
  } else {
    md += `⚠️ ${failed} layer(s) failed\n\n`;
  }

  md += `## Layer Results\n\n`;
  for (const result of results) {
    const status = result.passed ? "✓" : "✗";
    md += `### ${status} Layer ${result.layer}: ${result.name}\n`;
    md += `- **Status:** ${result.passed ? "PASSED" : "FAILED"}\n`;
    md += `- **Duration:** ${Math.round(result.duration / 1000)}s\n`;
    if (result.error) {
      md += `- **Error:** ${result.error}\n`;
    }
    md += `\n`;
  }

  return md;
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
