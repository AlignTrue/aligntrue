#!/usr/bin/env node

/**
 * Validate that Next.js apps have transpilePackages configured
 * for workspace packages that export TypeScript source directly.
 *
 * This prevents "Cannot find module" errors when Next.js tries
 * to import workspace packages without transpilation.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const errors = [];

/**
 * Check if a workspace package exports TypeScript source directly
 * (no build step, exports from src/)
 */
function isSourcePackage(packagePath) {
  try {
    const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));

    // Check if exports point to src/ (no build step)
    if (pkg.exports) {
      const exportsStr = JSON.stringify(pkg.exports);
      return exportsStr.includes("/src/");
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Get transpilePackages from Next.js config
 */
function getTranspilePackages(configPath, isESM = false) {
  try {
    const content = readFileSync(configPath, "utf-8");

    // Extract transpilePackages array
    const match = content.match(/transpilePackages:\s*\[(.*?)\]/s);
    if (!match) {
      return [];
    }

    // Parse package names from array
    const packagesStr = match[1];
    const packages = packagesStr
      .split(",")
      .map((p) => p.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    return packages;
  } catch (error) {
    return [];
  }
}

// Check apps/web/next.config.ts
console.log("🔍 Validating Next.js transpilePackages config...\n");

const webConfigPath = join(rootDir, "apps/web/next.config.ts");
const webTranspilePackages = getTranspilePackages(webConfigPath);

console.log("📦 apps/web/next.config.ts");
console.log(`   transpilePackages: ${JSON.stringify(webTranspilePackages)}`);

// Check apps/docs/next.config.mjs
const docsConfigPath = join(rootDir, "apps/docs/next.config.mjs");
const docsTranspilePackages = getTranspilePackages(docsConfigPath, true);

console.log("📦 apps/docs/next.config.mjs");
console.log(`   transpilePackages: ${JSON.stringify(docsTranspilePackages)}`);

// Check packages/ui (known source package)
const uiPackagePath = join(rootDir, "packages/ui/package.json");
const isUiSourcePackage = isSourcePackage(uiPackagePath);

console.log("\n📦 Workspace packages:");
console.log(
  `   @aligntrue/ui: ${isUiSourcePackage ? "source package (requires transpilation)" : "built package"}`,
);

// Validation
if (isUiSourcePackage && !webTranspilePackages.includes("@aligntrue/ui")) {
  errors.push("apps/web: Missing '@aligntrue/ui' in transpilePackages");
}

if (isUiSourcePackage && !docsTranspilePackages.includes("@aligntrue/ui")) {
  errors.push("apps/docs: Missing '@aligntrue/ui' in transpilePackages");
}

// Report results
console.log("\n" + "=".repeat(60));
if (errors.length === 0) {
  console.log("✅ All Next.js apps have correct transpilePackages config");
  process.exit(0);
} else {
  console.error("❌ transpilePackages validation failed:\n");
  for (const error of errors) {
    console.error(`   • ${error}`);
  }
  console.error(
    "\n💡 Fix: Add source packages to transpilePackages in Next.js config",
  );
  console.error(
    "   See: https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages",
  );
  process.exit(1);
}
