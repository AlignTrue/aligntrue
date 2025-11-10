#!/usr/bin/env node

/**
 * Final cleanup for 6 remaining exporters
 * Removes legacy methods and unused imports
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const EXPORTERS_DIR = resolve(process.cwd(), "packages/exporters/src");

const EXPORTERS = [
  "junie",
  "kilocode",
  "kiro",
  "openhands",
  "root-mcp",
  "trae-ai",
  "windsurf-mcp",
];

console.log(`Final cleanup for ${EXPORTERS.length} exporters\n`);

EXPORTERS.forEach((name) => {
  const file = join(EXPORTERS_DIR, name, "index.ts");

  try {
    let content = readFileSync(file, "utf8");

    // 1. Remove entire override computeFidelityNotes method block
    content = content.replace(
      /\s*\/\*\*[\s\S]*?\*\/\s*override\s+computeFidelityNotes[\s\S]*?\n\s*}\s*\n/g,
      "\n",
    );

    // 2. Remove private methods that generate content from rules
    content = content.replace(
      /\s*private\s+generate\w+\s*\([\s\S]*?rules:[\s\S]*?\n\s*}\s*\n/g,
      "\n",
    );

    // 3. Remove unused imports
    content = content.replace(
      /import\s+type\s+{\s*ModeHints\s*}\s+from\s+"@aligntrue\/core";\n?/g,
      "",
    );
    content = content.replace(
      /import\s+{\s*extractModeConfig,[\s\S]*?shouldIncludeRule,\s*}\s+from\s+"\.\.\/utils\/index\.js";\n?/g,
      "",
    );

    // 4. Clean extra whitespace
    content = content.replace(/\n\n\n+/g, "\n\n");

    writeFileSync(file, content, "utf8");
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}: ${err.message}`);
  }
});

console.log(`\n✅ Cleaned ${EXPORTERS.length} exporters\n`);
