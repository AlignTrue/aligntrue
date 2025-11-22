#!/usr/bin/env node
/**
 * Single Layer Test Runner (Local Workspace)
 *
 * Executes a specific test layer using the local workspace build.
 *
 * Usage: tsx run-single-layer-local.ts <layer-number>
 * Example: tsx run-single-layer-local.ts 2
 */

import { execSync, type ExecException } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

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

// Parse arguments
const layerArg = process.argv[2];

if (!layerArg) {
  console.error("Usage: tsx run-single-layer-local.ts <layer-number>");
  console.error("Example: tsx run-single-layer-local.ts 2");
  console.error("\nValid layers: 1-8");
  process.exit(2);
}

const layer = parseInt(layerArg, 10);
if (isNaN(layer) || layer < 1 || layer > 8) {
  console.error(`Error: Invalid layer '${layerArg}'. Valid layers: 1-8`);
  process.exit(2);
}

// Get workspace root
const currentDir = new URL(import.meta.url).pathname;
const cliDir = resolve(currentDir, "../../../");
const workspaceRoot = resolve(cliDir, "../../");
const cliPath = resolve(cliDir, "dist/index.js");

// Verify CLI is built
if (!existsSync(cliPath)) {
  console.error(
    `ERROR: CLI not built. Run 'pnpm build' first or 'cd ${workspaceRoot} && pnpm build'`,
  );
  process.exit(1);
}

const layerName = layerNames[layer - 1];
const timestamp = Date.now();
const testBaseDir = join(
  tmpdir(),
  `aligntrue-test-layer-${layer}-${timestamp}`,
);
const workspace = join(testBaseDir, "workspace");
const logFile = join(testBaseDir, "output.log");

console.log(`\n${"=".repeat(60)}`);
console.log(`AlignTrue Layer ${layer}: ${layerName}`);
console.log("=".repeat(60));
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Test directory: ${workspace}`);
console.log(`CLI path: ${cliPath}\n`);

mkdirSync(workspace, { recursive: true });

const layerScript = resolve(
  cliDir,
  `tests/comprehensive/layers/layer-${layer}-*.ts`,
);

let layerFile: string;
try {
  const matches = execSync(`ls ${layerScript}`, { encoding: "utf-8" })
    .trim()
    .split("\n");
  layerFile = matches[0];
} catch {
  console.error(`ERROR: Layer ${layer} script not found at ${layerScript}`);
  process.exit(1);
}

const env = {
  ...process.env,
  TZ: "UTC",
  NODE_ENV: "test",
  ALIGNTRUE_CLI: cliPath,
  TEST_WORKSPACE: workspace,
  LOG_FILE: logFile,
};

console.log(`Executing: node --loader tsx ${layerFile}\n`);

const startTime = Date.now();

try {
  execSync(`node --loader tsx ${layerFile}`, {
    cwd: workspace,
    env,
    stdio: "inherit",
  });

  const duration = Date.now() - startTime;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✓ Layer ${layer} passed (${Math.round(duration / 1000)}s)`);
  console.log("=".repeat(60));
  console.log(`\nTest directory: ${workspace}`);
  console.log(`(Keep for debugging, or delete with: rm -rf ${testBaseDir})\n`);
  process.exit(0);
} catch (err) {
  const execErr = err as ExecException;
  const duration = Date.now() - startTime;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✗ Layer ${layer} failed (${Math.round(duration / 1000)}s)`);
  console.log(`Exit code: ${execErr.status || 1}`);
  console.log("=".repeat(60));
  console.log(`\nTest directory: ${workspace}`);
  console.log(`(Kept for debugging. Delete with: rm -rf ${testBaseDir})\n`);
  process.exit(1);
}
