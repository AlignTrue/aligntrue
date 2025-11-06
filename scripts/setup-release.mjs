#!/usr/bin/env node
/**
 * Setup script for release workflow
 * Run once to configure alpha pre-release mode
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const preJsonPath = resolve(process.cwd(), ".changeset/pre.json");

console.log("🔍 Checking release setup...\n");

// Check if already in pre-release mode
if (existsSync(preJsonPath)) {
  console.log("✅ Already in alpha pre-release mode");
  console.log("   (.changeset/pre.json exists)\n");
} else {
  console.log("📦 Entering alpha pre-release mode...");
  try {
    execSync("pnpm changeset pre enter alpha", { stdio: "inherit" });
    console.log("\n✅ Alpha pre-release mode enabled");
    console.log("   Created .changeset/pre.json\n");
    console.log("💡 Next steps:");
    console.log("   1. git add .changeset/pre.json");
    console.log('   2. git commit -m "chore: enter alpha pre-release mode"');
    console.log("   3. git push\n");
  } catch (error) {
    console.error("❌ Failed to enter pre-release mode");
    console.error(error.message);
    process.exit(1);
  }
}

// Check for NPM_TOKEN in environment (for local testing)
console.log("🔑 Checking npm authentication...");
try {
  execSync("npm whoami", { stdio: "pipe" });
  const username = execSync("npm whoami", { encoding: "utf-8" }).trim();
  console.log(`✅ Logged in to npm as: ${username}\n`);
} catch {
  console.log("⚠️  Not logged in to npm locally");
  console.log("   This is OK - GitHub Actions uses NPM_TOKEN secret");
  console.log("   To test locally: npm login\n");
}

console.log("📚 Quick reference:");
console.log("   • Create changeset:  pnpm changeset");
console.log("   • Check status:      pnpm changeset status");
console.log("   • Manual release:    pnpm release");
console.log("\n📖 Full docs: docs/development/release-process.md");
console.log("📖 Quick guide: RELEASING.md\n");
