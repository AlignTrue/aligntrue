#!/usr/bin/env node

/**
 * Minimal cleanup that won't break syntax
 * Only removes legacy imports, keeps methods in place
 * Remaining exporters will need manual methods refactoring
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const EXPORTERS_DIR = resolve(process.cwd(), "packages/exporters/src");

const EXPORTERS = ["trae-ai", "windsurf-mcp"];

console.log(`Minimal cleanup for last 2 exporters\n`);

EXPORTERS.forEach((exporterName) => {
  const filePath = join(EXPORTERS_DIR, exporterName, "index.ts");

  try {
    let content = readFileSync(filePath, "utf8");

    // Remove isSectionBasedPack import ONLY
    content = content.replace(/,\s*isSectionBasedPack\s*(?=,|\})/g, "");
    content = content.replace(
      /import\s*{\s*isSectionBasedPack\s*}\s*from\s*"@aligntrue\/schema";\n?/g,
      "",
    );

    writeFileSync(filePath, content, "utf8");
    console.log(`✅ ${exporterName} - removed imports`);
  } catch (err) {
    console.error(`❌ ${exporterName}: ${err.message}`);
  }
});

console.log(
  `\n⚠️  trae-ai and windsurf-mcp still need manual method cleanup\n`,
);
