#!/usr/bin/env node

/**
 * Remove legacy method overrides and code from exporters
 * Deletes computeFidelityNotes overrides and rule-based generation methods
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const EXPORTERS_DIR = resolve(process.cwd(), "packages/exporters/src");

// Exporters that need manual method removal
const NEEDS_CLEANUP = [
  "aider-config",
  "amazonq-mcp",
  "augmentcode",
  "cline",
  "cursor-mcp",
  "firebase-studio",
  "firebender",
  "goose",
  "junie",
  "kilocode",
  "kiro",
  "openhands",
  "root-mcp",
  "trae-ai",
  "windsurf-mcp",
];

console.log(`Removing legacy methods from ${NEEDS_CLEANUP.length} exporters\n`);

let cleanedCount = 0;
let errorCount = 0;

NEEDS_CLEANUP.forEach((exporterName) => {
  const filePath = join(EXPORTERS_DIR, exporterName, "index.ts");

  try {
    let content = readFileSync(filePath, "utf8");
    const original = content;

    // 1. Remove override computeFidelityNotes methods entirely
    // Match: override computeFidelityNotes(...) { ... } with nested braces
    content = content.replace(
      /\s*override\s+computeFidelityNotes\s*\([\s\S]*?\n\s*}\s*\n/g,
      "\n",
    );

    // 2. Remove rule-based content generation methods
    // Remove methods that take AlignRule[] parameter
    content = content.replace(
      /\s*private\s+generate\w+\s*\([\s\S]*?rules:\s*AlignRule\[\][\s\S]*?\n\s*}\s*\n/g,
      "\n",
    );

    // 3. Remove interface definitions for legacy structures
    content = content.replace(
      /\s*interface\s+\w+Rule\s*{[\s\S]*?}\s*\n/g,
      "\n",
    );

    // 4. Remove ExporterState interface sections for allRules
    content = content.replace(/\s*allRules:\s*Array<{[\s\S]*?}>;?\s*/g, "");

    // 5. Remove useSections from ExporterState
    content = content.replace(/\s*useSections:\s*boolean;\s*/g, "");

    // 6. Clean duplicate content hash imports (sometimes script adds them)
    const lines = content.split("\n");
    const seen = new Set();
    const filtered = lines.filter((line) => {
      const cleanLine = line.trim();
      if (cleanLine.startsWith("import") || cleanLine.startsWith("export")) {
        if (seen.has(cleanLine)) {
          return false;
        }
        seen.add(cleanLine);
      }
      return true;
    });
    content = filtered.join("\n");

    // 7. Clean extra whitespace
    content = content.replace(/\n\n\n+/g, "\n\n");

    if (content !== original) {
      writeFileSync(filePath, content, "utf8");
      cleanedCount++;
      console.log(`✅ ${exporterName}`);
    } else {
      console.log(`⏭️  ${exporterName} - no changes`);
    }
  } catch (err) {
    errorCount++;
    console.error(`❌ ${exporterName}: ${err.message}`);
  }
});

console.log(`\n📊 Results: ${cleanedCount} cleaned, ${errorCount} errors`);
console.log("\n▶️  Next: Build again to check remaining issues\n");
