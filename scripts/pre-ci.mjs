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
  { name: "Lint", cmd: "pnpm lint --max-warnings 460" },
  { name: "Format check", cmd: "pnpm format:check" },
  { name: "Run tests", cmd: "pnpm test" },
  {
    name: "Validate bundle sizes",
    cmd: "node scripts/validate-bundle-sizes.mjs",
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
      execSync(step.cmd, { stdio: "pipe" });
    }
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(` ✓ (${duration}s)`);
  } catch (err) {
    console.log(` ✗`);
    console.error(`\n❌ ${step.name} failed\n`);
    console.error(
      err.stdout?.toString() || err.stderr?.toString() || err.message,
    );
    console.error(`\n💡 Fix the errors above and run 'pnpm pre-ci' again`);
    console.error(`   Or use 'git push --no-verify' to skip validation\n`);
    process.exit(1);
  }
}

const totalDuration = ((Date.now() - totalStart) / 1000).toFixed(1);
console.log(`\n✅ All pre-CI checks passed in ${totalDuration}s!`);
console.log("   Your code is ready to push to CI\n");
