#!/usr/bin/env node

import { execSync } from "child_process";
import * as clack from "@clack/prompts";

async function main() {
  clack.intro("🔍 Running pre-commit checks...");
  const s = clack.spinner();

  s.start("Formatting and linting staged files...");
  try {
    execSync("pnpm lint-staged", { stdio: "inherit" });
    s.stop("✅ Files formatted and linted successfully.");
  } catch (error) {
    s.stop("❌ Formatting or linting failed.", 1);
    console.error("");
    clack.log.error("Pre-commit checks failed.");
    console.error("");

    // Try to capture and parse lint-staged output for specific errors
    try {
      const result = execSync("pnpm lint-staged", {
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
    console.error("   • Auto-fix most issues: pnpm lint:fix");
    console.error("   • Fix formatting: pnpm format");
    console.error("   • Check specific file: pnpm eslint <file-path>");
    console.error("");
    console.error("💡 Common issues:");
    console.error(
      "   • Unused variables → prefix with underscore (_var) or remove",
    );
    console.error(
      "   • Image warnings → add eslint-disable comment if intentional",
    );
    console.error("   • Formatting → run pnpm format");
    console.error("");
    clack.outro("Fix the issues above and try committing again.");
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
    console.error(
      "📦 If you modified Next.js configs or added workspace packages:",
    );
    console.error("   • Check that transpilePackages includes source packages");
    console.error(
      "   • See: https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages",
    );
    console.error("");
    console.error(
      "🔍 Re-run validation: node scripts/validate-transpile-packages.mjs",
    );
    console.error("");
    clack.outro("💡 Fix the config and re-stage the files.");
    process.exit(1);
  }

  clack.outro("✅ Pre-commit checks passed");
  process.exit(0);
}

main();
