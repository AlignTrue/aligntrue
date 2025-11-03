#!/usr/bin/env node
import { execSync } from "child_process";
import * as clack from "@clack/prompts";

/**
 * Pre-refactor validation script
 * 
 * Run this before large refactors to ensure clean baseline:
 * - Type checks entire workspace
 * - Lints entire workspace
 * 
 * Use before: type changes, cross-package edits, large refactors
 */

async function main() {
  clack.intro("🔍 Pre-refactor validation");
  const s = clack.spinner();

  // Step 1: Type check workspace
  s.start("Type checking workspace...");
  try {
    execSync("pnpm typecheck", { stdio: "inherit" });
    s.stop("✅ Type checking passed");
  } catch {
    s.stop("❌ Type checking failed");
    clack.outro("Fix type errors before starting refactor");
    process.exit(1);
  }

  // Step 2: Lint workspace
  s.start("Linting workspace...");
  try {
    execSync("pnpm lint", { stdio: "inherit" });
    s.stop("✅ Linting passed");
  } catch {
    s.stop("❌ Linting failed");
    clack.outro("Fix lint errors before starting refactor");
    process.exit(1);
  }

  clack.outro("✅ Workspace is clean - safe to refactor");
}

main().catch((error) => {
  console.error("Pre-refactor validation failed:", error);
  process.exit(1);
});

