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

  // Check for large batch of staged files
  try {
    if (stagedFiles.length > 50) {
      clack.log.warn(
        `⚠️  Large commit detected: ${stagedFiles.length} files staged`,
      );
      clack.log.message(
        "Staging many files at once will lint ALL of them, which may surface pre-existing warnings.",
      );
      clack.log.message(
        "Consider splitting into smaller commits with 'git add -p' or '--patch'.",
      );
      clack.log.message("");
    }
  } catch (error) {
    // Non-fatal: continue with commit if this check fails
  }

  // Check for protected files (auto-generated from docs)
  s.start("Checking for protected file edits...");
  try {
    const protectedFiles = [
      "README.md",
      "CONTRIBUTING.md",
      "DEVELOPMENT.md",
      "SECURITY.md",
    ];
    const editedProtected = stagedFiles.filter((f) =>
      protectedFiles.includes(f),
    );

    if (editedProtected.length > 0) {
      s.stop("❌ Protected files were directly edited.", 1);
      console.error("");
      clack.log.error("Protected files were directly edited");
      console.error("");
      console.error("📝 These files are generated from docs content:");
      editedProtected.forEach((file) => {
        console.error(`   ${file}`);
      });
      console.error("");
      console.error("🔄 Correct workflow:");
      console.error("   1. Edit source files in apps/docs/content/");
      console.error("   2. Run: pnpm generate:repo-files");
      console.error("   3. Commit both docs changes AND generated files");
      console.error("");
      console.error("📚 Mappings:");
      console.error("   • README.md ← apps/docs/content/index.mdx");
      console.error(
        "   • CONTRIBUTING.md ← apps/docs/content/06-contributing/creating-packs.md",
      );
      console.error(
        "   • DEVELOPMENT.md ← apps/docs/content/08-development/*.md",
      );
      console.error(
        "   • SECURITY.md ← apps/docs/content/07-policies/security.md",
      );
      console.error("");
      clack.outro("Follow the workflow above and try again.");
      process.exit(1);
    }
    s.stop("✅ No protected files edited.");
  } catch (error) {
    // Non-fatal: continue with commit if this check fails
    s.stop("⚠️  Protected file check skipped.");
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
    console.error("⚠️  Linting threshold lowered to 400 warnings (was 460)");
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
      "⚠️  Note: Pre-commit enforces same limits as CI (400 warnings)",
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

  // Validate documentation accuracy if docs files changed
  const docsChanged = stagedFiles.some(
    (f) =>
      f.startsWith("apps/docs/content/") ||
      f === "package.json" ||
      f.startsWith("packages/cli/src/index.ts") ||
      f.startsWith("packages/exporters/src/") ||
      f.startsWith("packages/cli/tests/integration/performance.test.ts"),
  );

  if (docsChanged) {
    s.start("Validating documentation accuracy...");
    try {
      execSync("node scripts/validate-docs-accuracy.mjs", { stdio: "pipe" });
      s.stop("✅ Documentation accuracy validated.");
    } catch (error) {
      s.stop("❌ Documentation validation failed.", 1);
      console.error("");
      clack.log.error("Documentation accuracy validation failed.");
      console.error("");
      console.error(
        "📚 Documentation must match implementation (code is source of truth):",
      );
      console.error("   • Node.js version requirements");
      console.error("   • CLI command counts");
      console.error("   • Exporter counts");
      console.error("   • Performance threshold claims");
      console.error("");
      console.error(
        "🔍 Re-run validation: node scripts/validate-docs-accuracy.mjs",
      );
      console.error("");
      clack.outro("💡 Update docs to match code and re-stage the files.");
      process.exit(1);
    }
  }

  clack.outro("✅ Pre-commit checks passed");
  process.exit(0);
}

main();
