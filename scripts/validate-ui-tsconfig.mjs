#!/usr/bin/env node

/**
 * Validate that UI packages with React have DOM libs in tsconfig.json
 *
 * Prevents typecheck errors when using browser APIs (window, document, localStorage, etc.)
 * in React components.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const UI_PACKAGES = ["packages/ui", "apps/web", "apps/docs"];

let hasErrors = false;

console.log("🔍 Validating UI package tsconfig files...\n");

for (const pkgPath of UI_PACKAGES) {
  const fullPath = join(rootDir, pkgPath);
  const tsconfigPath = join(fullPath, "tsconfig.json");
  const packageJsonPath = join(fullPath, "package.json");

  if (!existsSync(tsconfigPath)) {
    console.log(`⚠️  Skipping ${pkgPath}: no tsconfig.json`);
    continue;
  }

  if (!existsSync(packageJsonPath)) {
    console.log(`⚠️  Skipping ${pkgPath}: no package.json`);
    continue;
  }

  // Check if package uses React
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const hasReact =
    packageJson.dependencies?.react ||
    packageJson.devDependencies?.react ||
    packageJson.peerDependencies?.react;

  if (!hasReact) {
    console.log(`✅ ${pkgPath}: No React dependency, DOM libs not required`);
    continue;
  }

  // Check tsconfig.json for DOM libs
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
  const lib = tsconfig.compilerOptions?.lib;

  if (!lib) {
    console.log(`✅ ${pkgPath}: No explicit lib config (inherits from base)`);
    continue;
  }

  const hasDOM = lib.some((l) => l.toLowerCase().includes("dom"));

  if (!hasDOM) {
    console.error(`❌ ${pkgPath}: Missing DOM libs in tsconfig.json`);
    console.error(
      `   Package uses React but tsconfig lib is: ${JSON.stringify(lib)}`,
    );
    console.error(`   Add: "lib": ["ES2022", "DOM", "DOM.Iterable"]`);
    console.error("");
    hasErrors = true;
  } else {
    console.log(`✅ ${pkgPath}: DOM libs configured correctly`);
  }
}

console.log("");

if (hasErrors) {
  console.error("❌ Validation failed: UI packages missing DOM libs");
  console.error("");
  console.error("Fix by adding to tsconfig.json compilerOptions:");
  console.error('  "lib": ["ES2022", "DOM", "DOM.Iterable"]');
  console.error("");
  process.exit(1);
} else {
  console.log("✅ All UI packages configured correctly");
  process.exit(0);
}
