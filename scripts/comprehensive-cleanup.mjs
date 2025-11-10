#!/usr/bin/env node

/**
 * Comprehensive cleanup for the 6 remaining problem exporters
 * 1. Remove legacy imports
 * 2. Simplify export method
 * 3. Properly remove entire legacy methods with their bodies
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const EXPORTERS_DIR = resolve(process.cwd(), "packages/exporters/src");

const EXPORTERS = [
  "kilocode",
  "kiro",
  "openhands",
  "root-mcp",
  "trae-ai",
  "windsurf-mcp",
];

console.log(`Comprehensive cleanup for ${EXPORTERS.length} exporters\n`);

let fixedCount = 0;

EXPORTERS.forEach((exporterName) => {
  const filePath = join(EXPORTERS_DIR, exporterName, "index.ts");

  try {
    let content = readFileSync(filePath, "utf8");

    // 1. Remove isSectionBasedPack import
    content = content.replace(/,?\s*isSectionBasedPack\s*(?=,|\})/g, "");

    // 2. Remove getSections import
    content = content.replace(/,?\s*getSections\s*(?=,|\})/g, "");

    // 3. Simplify export method
    // Find and replace: const useSections = isSectionBasedPack(pack);
    //                   const sections = useSections ? pack.sections! : [];
    content = content.replace(
      /const\s+useSections\s*=\s*isSectionBasedPack\(pack\);[\s\n]*const\s+sections\s*=\s*useSections\s*\?\s*pack\.sections!\s*:\s*\[\];/g,
      "const sections = pack.sections;",
    );

    // 4. Remove request.rules from destructuring
    content = content.replace(
      /const\s+{\s*scope\s*,\s*rules\s*,\s*pack\s*}\s*=\s*request;/g,
      "const { scope, pack } = request;",
    );

    // 5. Find and remove entire method blocks
    // Match entire private/override methods by finding method declaration and matching braces
    const methodPatterns = [
      // Method with AlignRule[] parameter
      /\n\s*(override|private)\s+\w+\s*\(\s*[^)]*rules:\s*AlignRule\[\][^)]*\)[^{]*\{[\s\S]*?(?=\n\s*(?:private|override|async|resetState|export|^}|$))/g,
      // computeFidelityNotes override
      /\n\s*override\s+computeFidelityNotes[^{]*\{[\s\S]*?(?=\n\s*(?:private|override|async|resetState|export|^}|$))/g,
    ];

    methodPatterns.forEach((pattern) => {
      content = content.replace(pattern, "\n");
    });

    // 6. Clean up orphaned code fragments
    // Lines with references to removed 'rules' variable
    const lines = content.split("\n");
    const cleaned = lines.filter((line) => {
      const trimmed = line.trim();
      // Skip lines that reference the removed rules variable
      if (
        trimmed.match(/^(const|let|var)\s+\w+\s*=\s*.*\.rules/) ||
        trimmed.match(/\.forEach\s*\(\s*\(\s*rule\s*\)/) ||
        trimmed.match(/this\.state\.allRules/)
      ) {
        return false;
      }
      return true;
    });
    content = cleaned.join("\n");

    // 7. Remove extraneous closing braces (max 3 consecutive, then cleanup)
    content = content.replace(/\n}\n}\n}\n/g, "\n}\n");
    content = content.replace(/\n}\n}\n/g, "\n}\n");

    // 8. Clean extra whitespace
    content = content.replace(/\n\n\n+/g, "\n\n");

    writeFileSync(filePath, content, "utf8");
    fixedCount++;
    console.log(`✅ ${exporterName}`);
  } catch (err) {
    console.error(`❌ ${exporterName}: ${err.message}`);
  }
});

console.log(`\n✅ Cleaned ${fixedCount}/${EXPORTERS.length} exporters\n`);
