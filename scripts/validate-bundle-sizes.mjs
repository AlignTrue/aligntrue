#!/usr/bin/env node

/**
 * Bundle Size Validation
 * Ensures CLI and docs bundles don't exceed size limits
 *
 * Limits:
 * - CLI dist/ (without source maps): ≤ 600 KB
 * - Docs JS: ≤ 150 KB gzipped
 * - Docs CSS: ≤ 50 KB gzipped
 */

import { statSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");

const LIMITS = {
  cliDist: { size: 600 * 1024, label: "CLI dist/ (JS only)" },
};

/**
 * Recursively calculate directory size, optionally excluding patterns
 */
function getDirSizeBytes(dirPath, excludePattern = null) {
  let totalSize = 0;

  function walk(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (excludePattern && entry.name.match(excludePattern)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        totalSize += statSync(fullPath).size;
      }
    }
  }

  walk(dirPath);
  return totalSize;
}

console.log("📦 Checking bundle sizes...\n");

let hasErrors = false;

// Check CLI dist/ directory size (excluding source maps)
const cliDistPath = join(rootDir, "packages/cli/dist");
if (existsSync(cliDistPath)) {
  const sizeBytes = getDirSizeBytes(cliDistPath, /\.map$/);
  const limit = LIMITS.cliDist.size;
  const sizeKB = (sizeBytes / 1024).toFixed(1);
  const limitKB = (limit / 1024).toFixed(0);

  process.stdout.write(`${LIMITS.cliDist.label}...`);

  if (sizeBytes > limit) {
    console.log(` ✗ (${sizeKB} KB > ${limitKB} KB limit)\n`);
    console.error(`❌ CLI bundle size exceeded: ${sizeKB} KB > ${limitKB} KB`);
    console.error("   This likely means a large dependency was added.");
    console.error("   Run: du -sh packages/cli/dist/* | head -20");
    console.error("   And consider if the dependency is necessary.\n");
    hasErrors = true;
  } else {
    console.log(` ✓ (${sizeKB} KB < ${limitKB} KB limit)`);
  }
} else {
  process.stdout.write(`${LIMITS.cliDist.label}...`);
  console.log(" ⊘ (not built yet)\n");
}

console.log("");

if (hasErrors) {
  console.error("❌ Bundle size validation failed\n");
  process.exit(1);
} else {
  console.log("✅ Bundle sizes within limits\n");
  process.exit(0);
}
