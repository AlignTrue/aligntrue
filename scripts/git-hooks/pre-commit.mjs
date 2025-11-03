#!/usr/bin/env node

import { execSync } from "child_process";
import * as clack from "@clack/prompts";

async function main() {
  clack.intro("🔍 Running pre-commit checks...");
  const s = clack.spinner();

  // Step 1: Format staged files
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

  // Step 2: Quick incremental typecheck (fail fast)
  const changedPackages = getChangedPackages();
  
  if (changedPackages.length > 0) {
    s.start(`Quick typecheck of ${changedPackages.length} changed package(s)...`);
    try {
      // Run quick typecheck on only changed packages to catch errors early
      for (const pkg of changedPackages) {
        execSync(`pnpm --filter ${pkg} exec tsc --noEmit`, { 
          stdio: "pipe",
          encoding: "utf-8"
        });
      }
      s.stop("✅ Quick typecheck passed.");
    } catch (error) {
      s.stop("❌ Type errors detected.", 1);
      console.error("");
      clack.log.error("TypeScript type checking failed.");
      console.error("");
      console.error("📝 Fix these type errors before committing:");
      console.error("");
      // Show the actual error output
      if (error.stdout) {
        console.error(error.stdout);
      }
      console.error("");
      console.error("💡 Tip: Run 'pnpm pre-refactor' before large changes");
      console.error("🔍 Re-run typecheck: pnpm typecheck");
      console.error("");
      clack.outro("Fix the type errors above and try committing again.");
      process.exit(1);
    }
  }

  // Step 3: Build workspace packages if source files changed
  let packageSrcFiles;
  try {
    packageSrcFiles = execSync(
      "git diff --cached --name-only --diff-filter=ACM | grep -E '^packages/.*/src/.*\\.(ts|tsx)$' || true",
      { encoding: "utf-8" },
    ).trim();
  } catch (error) {
    packageSrcFiles = "";
  }

  if (packageSrcFiles && changedPackages.length > 0) {
    s.start(`Building ${changedPackages.length} changed package(s)...`);
    try {
      // Build only changed packages for faster commits
      const filters = changedPackages.map(p => `--filter ${p}`).join(" ");
      execSync(`pnpm ${filters} build`, { stdio: "inherit" });
      s.stop("✅ Packages built successfully.");
    } catch (error) {
      s.stop("❌ Build failed.", 1);
      console.error("");
      clack.log.error("TypeScript compilation failed.");
      console.error("");
      console.error("📝 Common TypeScript Strictness Patterns:");
      console.error("");
      console.error("   1. Indexed access returns T | undefined:");
      console.error("      const value = record[key];  // string | undefined");
      console.error("      if (!value) throw new Error('Missing key');");
      console.error("      useValue(value);  // Now narrowed to string");
      console.error("");
      console.error("   2. Optional properties cannot be undefined:");
      console.error("      return { data, ...(error !== undefined && { error }) };");
      console.error("");
      console.error("   3. Function parameters need explicit checks:");
      console.error("      if (!param) { log.warn('Missing param'); return; }");
      console.error("");
      console.error("📖 Complete patterns: .cursor/rules/typescript.mdc");
      console.error("🔍 Re-run build: pnpm build:packages");
      console.error("");
      clack.outro("💡 Fix the TypeScript errors above and try committing again.");
      process.exit(1);
    }
  }

  // Step 4: Full typecheck of changed packages (final validation)
  if (changedPackages.length > 0) {
    s.start("Final typecheck of changed packages...");
    try {
      const filters = changedPackages.map(p => `--filter ${p}`).join(" ");
      execSync(`pnpm ${filters} typecheck`, { stdio: "inherit" });
      s.stop("✅ Type checking passed.");
    } catch (error) {
      s.stop("❌ Type checking failed.", 1);
      console.error("");
      clack.log.error("TypeScript type checking failed.");
      console.error("");
      console.error("📝 These are stricter checks than compilation.");
      console.error("   They catch potential runtime errors before they happen.");
      console.error("");
      console.error("   Common fixes:");
      console.error("   • Add explicit type annotations for complex expressions");
      console.error("   • Use 'as const' for literal unions");
      console.error("   • Narrow types with guards: if (typeof x === 'string')");
      console.error("   • Validate at boundaries: parse(input) throws on bad data");
      console.error("");
      console.error("🔍 Re-run typecheck: pnpm typecheck");
      console.error("");
      clack.outro("💡 Fix the type errors above and try committing again.");
      process.exit(1);
    }
  }

  clack.outro("✅ All pre-commit checks passed");
  process.exit(0);
}

/**
 * Get list of changed packages from staged files
 * @returns Array of package names (e.g., ["@aligntrue/cli", "@aligntrue/core"])
 */
function getChangedPackages() {
  try {
    const stagedFiles = execSync(
      "git diff --cached --name-only --diff-filter=ACM",
      { encoding: "utf-8" }
    ).trim().split("\n").filter(Boolean);
    
    const packages = new Set();
    for (const file of stagedFiles) {
      // Match files in packages/* or apps/*
      const match = file.match(/^(packages|apps)\/([^/]+)\//);
      if (match) {
        const [, type, name] = match;
        packages.add(`@aligntrue/${name}`);
      }
    }
    return Array.from(packages);
  } catch (error) {
    return [];
  }
}

main();
