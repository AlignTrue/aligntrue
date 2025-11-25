#!/usr/bin/env node
/**
 * Single layer test runner
 * Usage: tsx run-single-layer.ts <layer-number>
 */

import { execSync, type ExecException } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

const layer = process.argv[2];

if (!layer || !/^[1-8]$/.test(layer)) {
  console.error("Usage: tsx run-single-layer.ts <layer-number>");
  console.error("Layer must be 1-8");
  process.exit(2);
}

const timestamp = Date.now();
const testDir = `/tmp/aligntrue-test-${timestamp}`;
const logFile = join(testDir, `layer-${layer}-output.log`);

console.log(`\n=== AlignTrue Comprehensive Testing ===`);
console.log(`Layer: ${layer}`);
console.log(`Test directory: ${testDir}`);
console.log(`Log file: ${logFile}\n`);

// Create test directory
mkdirSync(testDir, { recursive: true });

// Set environment
process.env.TZ = "UTC";
process.env.NODE_ENV = "test";
process.env.TEST_WORKSPACE = join(testDir, "workspace");
process.env.LOG_FILE = logFile;

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

// Create test workspace
mkdirSync(process.env.TEST_WORKSPACE, { recursive: true });

// Add CLI to PATH
const cliPath = join(repoDir, "packages/cli/dist/index.js");
process.env.PATH = `${join(repoDir, "packages/cli/dist")}:${process.env.PATH}`;

console.log(`\nExecuting Layer ${layer}...\n`);

const layerScript = join(
  repoDir,
  `packages/cli/tests/comprehensive/layers/layer-${layer}-*.ts`,
);
const layerFiles = globSync(layerScript);

if (layerFiles.length === 0) {
  console.error(`Layer ${layer} script not found`);
  process.exit(2);
}

const layerFile = layerFiles[0];

try {
  execSync(`node --import tsx ${layerFile}`, {
    cwd: process.env.TEST_WORKSPACE,
    stdio: "inherit",
    env: {
      ...process.env,
      ALIGNTRUE_CLI: cliPath,
    },
  });

  console.log(`\n✓ Layer ${layer} completed successfully`);
  console.log(`Log file: ${logFile}`);

  // Copy log to internal docs
  const internalDocsDir = join(repoDir, ".internal_docs");
  if (!existsSync(internalDocsDir)) {
    mkdirSync(internalDocsDir, { recursive: true });
  }

  const reportPath = join(
    internalDocsDir,
    `test-layer-${layer}-${timestamp}.log`,
  );
  if (existsSync(logFile)) {
    copyFileSync(logFile, reportPath);
    console.log(`Report saved: ${reportPath}`);
  }

  // Cleanup
  console.log("\nCleaning up...");
  rmSync(testDir, { recursive: true, force: true });

  process.exit(0);
} catch (err) {
  const execErr = err as ExecException;
  console.error(`\n✗ Layer ${layer} failed`);
  console.error(`Exit code: ${execErr.code || 1}`);
  console.error(`Log file: ${logFile}`);

  // Cleanup
  console.log("\nCleaning up...");
  rmSync(testDir, { recursive: true, force: true });

  process.exit(1);
}
