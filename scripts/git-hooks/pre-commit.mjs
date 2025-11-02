#!/usr/bin/env node

import { execSync } from "child_process";
import * as clack from "@clack/prompts";

async function main() {
  clack.intro("🔍 Running pre-commit checks...");
  const s = clack.spinner();

  // Step 1: Format staged files
  s.start("Formatting staged files with Prettier...");
  try {
    execSync("pnpm lint-staged", { stdio: "pipe" });
    s.stop("✅ Files formatted successfully.");
  } catch (error) {
    s.stop("❌ Formatting failed.", 1);
    clack.log.error("Could not format staged files.");
    console.error("\n📝 Some files were not correctly formatted by Prettier.");
    console.error(
      "   This usually happens when there are syntax errors in the staged files.",
    );
    console.error(
      "\n   Please review the errors above, fix them, and try committing again.",
    );
    console.error(
      "\n   You can also run 'pnpm format' to format the entire project and see if there are other issues.",
    );
    clack.outro("💡 Fix the formatting issues and re-stage the files.");
    process.exit(1);
  }

  // Step 2: Build workspace packages if source files changed
  let packageSrcFiles;
  try {
    packageSrcFiles = execSync(
      "git diff --cached --name-only --diff-filter=ACM | grep -E '^packages/.*/src/.*\\.(ts|tsx)$' || true",
      { encoding: "utf-8" },
    ).trim();
  } catch (error) {
    packageSrcFiles = "";
  }

  if (packageSrcFiles) {
    s.start("Building workspace packages (source files changed)...");
    try {
      // Build packages only (not apps) to ensure fresh types for typecheck
      execSync("pnpm -r --filter './packages/*' build", { stdio: "pipe" });
      s.stop("✅ Packages built successfully.");
    } catch (error) {
      s.stop("❌ Build failed.", 1);
      clack.log.error("Build errors detected in workspace packages.");
      console.error("\n📝 Please fix the build errors before committing:");
      console.error("\n   Run: pnpm -r --filter './packages/*' build");
      console.error("   Or:  pnpm --filter @aligntrue/<package> build");
      console.error(
        "\n   This ensures all packages have fresh type definitions.",
      );
      clack.outro("💡 Fix the build errors and try committing again.");
      process.exit(1);
    }
  }

  // Step 3: Typecheck staged TypeScript files
  let stagedTsFiles;
  try {
    stagedTsFiles = execSync(
      "git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(ts|tsx)$' || true",
      { encoding: "utf-8" },
    ).trim();
  } catch (error) {
    // grep returns non-zero if no matches, which is fine
    stagedTsFiles = "";
  }

  if (stagedTsFiles) {
    s.start("Type checking staged TypeScript files...");
    try {
      execSync("pnpm -r typecheck", { stdio: "pipe" });
      s.stop("✅ Type checking passed.");
    } catch (error) {
      s.stop("❌ Type checking failed.", 1);
      clack.log.error("TypeScript errors detected in staged files.");
      console.error("\n📝 Please fix the type errors before committing:");
      console.error("\n   Run: pnpm -r typecheck");
      console.error("   Or:  pnpm -r --filter <package> typecheck");
      console.error(
        "\n   This prevents type errors from blocking push operations later.",
      );
      clack.outro("💡 Fix the type errors and try committing again.");
      process.exit(1);
    }
  }

  clack.outro("All pre-commit checks passed");
  process.exit(0);
}

main();
