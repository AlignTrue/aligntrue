#!/usr/bin/env node

/**
 * Standalone Link Checker for AlignTrue Documentation
 *
 * Wrapper script that uses the shared link checker module.
 * For automated checks, prefer running the test suite: pnpm --filter @aligntrue/docs test
 *
 * Usage: node scripts/check-docs-links.js
 */

import { checkAllLinks, getLinkStats } from "../apps/docs/lib/check-links.ts";

console.log("🔍 Checking documentation links...\n");

const brokenLinks = checkAllLinks();
const stats = getLinkStats();

console.log(`\n${"=".repeat(70)}`);
console.log(`Checked: ${stats.totalLinks} links in ${stats.totalFiles} files`);
console.log(`${"=".repeat(70)}\n`);

if (brokenLinks.length === 0) {
  console.log("✅ All links are valid!\n");
  process.exit(0);
} else {
  console.log(`❌ Found ${brokenLinks.length} broken links:\n`);

  // Group errors by file
  const errorsByFile = {};
  for (const link of brokenLinks) {
    if (!errorsByFile[link.file]) {
      errorsByFile[link.file] = [];
    }
    errorsByFile[link.file].push(link);
  }

  // Print grouped errors
  for (const [file, fileErrors] of Object.entries(errorsByFile)) {
    console.log(`📄 ${file}`);
    for (const error of fileErrors) {
      console.log(
        `   Line ${error.line}: [${error.linkText}](/docs/${error.linkPath})`,
      );
      console.log(`   → Expected file: ${error.expectedFile}`);
    }
    console.log();
  }

  process.exit(1);
}
