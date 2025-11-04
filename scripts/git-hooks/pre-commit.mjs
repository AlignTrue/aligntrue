#!/usr/bin/env node

import { execSync } from "child_process";
import * as clack from "@clack/prompts";

async function main() {
  clack.intro("🔍 Running pre-commit checks...");
  const s = clack.spinner();

  s.start("Formatting staged files with Prettier...");
  try {
    execSync("pnpm lint-staged", { stdio: "inherit" });
    s.stop("✅ Files formatted successfully.");
  } catch (error) {
    s.stop("❌ Formatting failed.", 1);
    console.error("");
    clack.log.error("Prettier formatting failed.");
    console.error("");
    console.error("📝 This usually means syntax errors in staged files:");
    console.error("   • Missing closing brackets, braces, or parentheses");
    console.error("   • Invalid JSON in config files");
    console.error("   • Malformed JSX or TypeScript syntax");
    console.error("");
    console.error("🔍 Re-run format: pnpm format");
    console.error("");
    clack.outro("💡 Fix the syntax errors above and re-stage the files.");
    process.exit(1);
  }

  s.start("Validating Next.js transpilePackages config...");
  try {
    execSync("node scripts/validate-transpile-packages.mjs", { stdio: "pipe" });
    s.stop("✅ Next.js config validated.");
  } catch (error) {
    s.stop("❌ Next.js validation failed.", 1);
    console.error("");
    clack.log.error("transpilePackages validation failed.");
    console.error("");
    console.error("📦 If you modified Next.js configs or added workspace packages:");
    console.error("   • Check that transpilePackages includes source packages");
    console.error("   • See: https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages");
    console.error("");
    console.error("🔍 Re-run validation: node scripts/validate-transpile-packages.mjs");
    console.error("");
    clack.outro("💡 Fix the config and re-stage the files.");
    process.exit(1);
  }

  clack.outro("✅ Pre-commit checks passed");
  process.exit(0);
}

main();
