#!/usr/bin/env node

/**
 * Fix syntax errors left by method removal
 * Removes orphaned code and incomplete method bodies
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const EXPORTERS_DIR = resolve(
  process.cwd(),
  "packages/exporters/src"
);

// Exporters with cleanup issues
const NEEDS_FIXES = [
  "kilocode",
  "kiro",
  "openhands",
  "root-mcp",
  "trae-ai",
  "windsurf-mcp",
];

console.log(`Fixing syntax errors in ${NEEDS_FIXES.length} exporters\n`);

let fixedCount = 0;

NEEDS_FIXES.forEach((exporterName) => {
  const filePath = join(EXPORTERS_DIR, exporterName, "index.ts");

  try {
    let content = readFileSync(filePath, "utf8");
    const original = content;

    // Remove lines with rules references that don't have proper context
    const lines = content.split("\n");
    const filtered: string[] = [];
    let braceDepth = 0;
    let inBrokenMethod = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip lines that reference 'rules' variable which was removed
      if (trimmed.includes("rules.") || trimmed.includes("rules,")) {
        if (trimmed.startsWith("const") || trimmed.startsWith("if") || trimmed.startsWith("for") || trimmed.startsWith(".map") || trimmed.startsWith(".forEach")) {
          // Skip these lines - they reference the removed rules variable
          continue;
        }
      }

      // Track braces to find where broken methods end
      if (trimmed.includes("{")) {
        braceDepth += (trimmed.match(/{/g) || []).length;
      }
      if (trimmed.includes("}")) {
        braceDepth -= (trimmed.match(/}/g) || []).length;
      }

      // Skip lines that are just closing braces with no context
      if (trimmed === "}" && braceDepth === 0 && i > 0) {
        const prevLine = filtered[filtered.length - 1] || "";
        if (prevLine.trim() === "" || prevLine.includes("lines.push")) {
          continue; // Skip orphaned closing brace
        }
      }

      filtered.push(line);
    }

    content = filtered.join("\n");

    // Clean up multiple empty lines
    content = content.replace(/\n\n\n+/g, "\n\n");

    // Remove trailing empty lines at end of methods
    content = content.replace(/(\n\n)(  |\t)\s*\n\s*}/g, "\n}");

    if (content !== original) {
      writeFileSync(filePath, content, "utf8");
      fixedCount++;
      console.log(`✅ ${exporterName}`);
    } else {
      console.log(`⏭️  ${exporterName}`);
    }
  } catch (err) {
    console.error(`❌ ${exporterName}: ${err.message}`);
  }
});

console.log(`\n📊 Fixed ${fixedCount} files`);
console.log("\n▶️  Manually inspect files for remaining issues\n");

