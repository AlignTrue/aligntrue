#!/usr/bin/env node

/**
 * Pre-CI validation script
 * Runs locally before push to catch CI failures early
 */

import { execSync } from "child_process";

const steps = [
  {
    name: "Install dependencies",
    cmd: "pnpm install --frozen-lockfile",
  },
  {
    name: "Build packages",
    cmd: "pnpm build",
  },
  { name: "Type check", cmd: "pnpm typecheck" },
  {
    name: "Run tests",
    cmd: "TURBO_CONCURRENCY=1 pnpm test",
    stdio: "inherit",
  },
];

console.log("🔍 Running pre-CI validation...");
console.log("This catches CI failures locally before you push\n");

const totalStart = Date.now();

for (const step of steps) {
  const start = Date.now();
  process.stdout.write(`${step.name}...`);

  try {
    if (typeof step.cmd === "function") {
      step.cmd();
    } else {
      execSync(step.cmd, {
        stdio: step.stdio || "pipe",
      });
    }
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    if (step.stdio === "inherit") {
      // For inherit mode, we already printed output, just show duration
      console.log(`\n✓ ${step.name} completed (${duration}s)`);
    } else {
      console.log(` ✓ (${duration}s)`);
    }
  } catch (err) {
    if (step.stdio === "inherit") {
      console.log(`\n✗ ${step.name} failed`);
    } else {
      console.log(` ✗`);
      console.error(`\n❌ ${step.name} failed\n`);
      console.error(
        err.stdout?.toString() || err.stderr?.toString() || err.message,
      );
    }
    console.error(`\n💡 Fix the errors above and run 'pnpm pre-ci' again`);
    console.error(`   Or use 'git push --no-verify' to skip validation\n`);
    process.exit(1);
  }
}

const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
console.log(`\n✅ All pre-CI checks passed in ${totalDuration}s!`);
console.log("   Your code is ready to push to CI\n");
