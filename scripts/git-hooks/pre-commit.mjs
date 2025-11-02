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
      execSync("pnpm -r --filter './packages/*' build", { stdio: "inherit" });
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
      console.error("🔍 Re-run build: pnpm -r --filter './packages/*' build");
      console.error("");
      clack.outro("💡 Fix the TypeScript errors above and try committing again.");
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
      execSync("pnpm -r typecheck", { stdio: "inherit" });
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
      console.error("🔍 Re-run typecheck: pnpm -r typecheck");
      console.error("");
      clack.outro("💡 Fix the type errors above and try committing again.");
      process.exit(1);
    }
  }

  clack.outro("All pre-commit checks passed");
  process.exit(0);
}

main();
