#!/usr/bin/env node

import { execSync } from "child_process";
import * as clack from "@clack/prompts";

async function main() {
  clack.intro("🔍 Running pre-commit checks...");
  const s = clack.spinner();

  // Get staged files early so we can reuse it in all checks
  let stagedFiles = [];
  try {
    stagedFiles = execSync("git diff --cached --name-only", {
      encoding: "utf8",
    })
      .trim()
      .split("\n")
      .filter((f) => f.length > 0);
  } catch {
    // If git command fails, continue with empty list
  }

  // Check for temporary debug files (per debugging.mdc: temp-* files must not be committed)
  const tempFiles = stagedFiles.filter(
    (f) => f.includes("temp-") || f.match(/\/temp-[^/]+$/),
  );
  if (tempFiles.length > 0) {
    clack.log.error("❌ Temporary debug files staged for commit:");
    tempFiles.forEach((f) => console.error(`   ${f}`));
    console.error("");
    console.error(
      "💡 Per debugging workflow: temp-* files are for investigation only.",
    );
    console.error("   Unstage with: git reset HEAD " + tempFiles.join(" "));
    console.error("   Or delete with: pnpm clean-temp");
    console.error("");
    process.exit(1);
  }

  // Run fast structural validations up front
  s.start("Running repository validation (validate:all)...");
  try {
    execSync("pnpm validate:all", { stdio: "inherit" });
    s.stop("✅ Repository validation passed.");
  } catch (error) {
    s.stop("❌ Repository validation failed.", 1);
    console.error("");
    clack.log.error("validate:all failed (workspace/tsconfig/transpile).");
    console.error("");
    console.error("Fix the reported issues and re-stage the files.");
    console.error("");
    process.exit(1);
  }

  s.start("Formatting and linting staged files...");
  try {
    execSync("pnpm lint-staged", { stdio: "inherit" });
    s.stop("✅ Files formatted and linted successfully.");
  } catch (error) {
    s.stop("❌ Formatting or linting failed.", 1);
    console.error("");
    clack.log.error("Pre-commit checks failed.");
    console.error("");
    console.error(
      "⚠️  Pre-commit enforces zero warnings. All security warnings must be addressed or exempted.",
    );
    console.error("");

    // Try to capture and parse lint-staged output for specific errors
    try {
      execSync("pnpm lint-staged", {
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (lintError) {
      const output = lintError.stdout || lintError.stderr || "";

      // Parse file paths from ESLint output
      const fileMatches = output.match(
        /\/[^\s]+\.(ts|tsx|js|jsx|md|json|yml|yaml)/g,
      );
      if (fileMatches && fileMatches.length > 0) {
        const uniqueFiles = [...new Set(fileMatches)];
        console.error("📋 Failed files:");
        uniqueFiles.forEach((file) => {
          // Count warnings/errors for this file
          const fileRegex = new RegExp(
            file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
              "[\\s\\S]*?(\\d+):(\\d+)",
            "g",
          );
          const matches = [...output.matchAll(fileRegex)];
          if (matches.length > 0) {
            console.error(
              `   ${file} (${matches.length} issue${matches.length > 1 ? "s" : ""})`,
            );
          } else {
            console.error(`   ${file}`);
          }
        });
        console.error("");
      }
    }

    console.error("🔧 Quick fixes:");
    console.error("   • Auto-fix most issues: pnpm lint:fix && pnpm format");
    console.error("   • Check specific file: pnpm eslint <file-path>");
    console.error("");
    console.error(
      "⚠️  Note: Pre-commit enforces zero warnings. Add exemptions in eslint.config.js for legitimate security protections.",
    );
    console.error("");
    console.error("💡 Common issues:");
    console.error(
      "   • Unused variables → prefix with underscore (_var) or remove",
    );
    console.error(
      "   • Underscore mismatch → if declared as _var, use _var everywhere",
    );
    console.error(
      "   • Image warnings → add eslint-disable comment if intentional",
    );
    console.error("   • Formatting → run pnpm format");
    console.error("");
    clack.outro("Fix the issues above and try committing again.");
    process.exit(1);
  }

  // Build TypeScript packages to catch module resolution and type errors
  s.start("Building affected packages...");
  try {
    // Check if any TypeScript files are staged
    const stagedTsFiles = stagedFiles.filter((f) => /\.(ts|tsx)$/.test(f));

    if (stagedTsFiles.length > 0) {
      // Extract package directories and build all affected packages
      // This catches missing imports, type errors, and module resolution issues
      // that ESLint cannot detect
      execSync("pnpm build:packages", {
        stdio: "inherit",
      });
    }

    s.stop("✅ Packages built successfully.");
  } catch (error) {
    s.stop("❌ Build failed.", 1);
    console.error("");
    clack.log.error("TypeScript build failed.");
    console.error("");
    console.error("❌ Build errors indicate:");
    console.error("   • Missing imports or exports");
    console.error("   • Type errors that ESLint cannot catch");
    console.error("   • Module resolution failures");
    console.error("");
    console.error("🔧 Quick fix:");
    console.error("   pnpm build:packages");
    console.error("");
    console.error("📚 Common causes:");
    console.error("   • Importing from removed/renamed module");
    console.error("   • Missing dependency between packages");
    console.error(
      "   • Incomplete deprecation (core removed export, CLI still uses it)",
    );
    console.error("");
    clack.outro("Fix the build errors above and try committing again.");
    process.exit(1);
  }

  // Typecheck after build to catch unresolved types before push/CI
  s.start("Type checking workspace...");
  try {
    execSync("pnpm typecheck", { stdio: "inherit" });
    s.stop("✅ Typecheck passed.");
  } catch (error) {
    s.stop("❌ Typecheck failed.", 1);
    console.error("");
    clack.log.error("Type errors detected.");
    console.error("");
    console.error("Fix the errors above and re-run the commit.");
    console.error("");
    process.exit(1);
  }

  clack.outro("✅ Pre-commit checks passed");
  process.exit(0);
}

main();
