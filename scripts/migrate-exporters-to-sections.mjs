#!/usr/bin/env node

/**
 * Migrate exporters from dual-format (rules/sections) to sections-only
 * Removes legacy format detection, conversions, and rule-based methods
 */

import { readFileSync, writeFileSync } from "fs";
import { readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const EXPORTERS_DIR = resolve(process.cwd(), "packages/exporters/src");

// Skip already-fixed exporters and base classes
const SKIP_LIST = [
  "agents-md",
  "cursor",
  "amazonq",
  "vscode-mcp",
  "base",
  "utils",
];

// Find all exporter directories
function getExporterDirs(dir) {
  const items = readdirSync(dir);
  return items.filter((item) => {
    const path = join(dir, item);
    return (
      statSync(path).isDirectory() &&
      !SKIP_LIST.includes(item) &&
      item[0] !== "."
    );
  });
}

const exporterDirs = getExporterDirs(EXPORTERS_DIR);

console.log(`Found ${exporterDirs.length} exporters to migrate\n`);

let fixedCount = 0;
let errorCount = 0;
const needsManualReview = [];

exporterDirs.forEach((exporterName) => {
  const filePath = join(EXPORTERS_DIR, exporterName, "index.ts");

  try {
    let content = readFileSync(filePath, "utf8");
    const original = content;

    // 1. Remove legacy imports from schema
    content = content.replace(
      /import\s*{\s*([^}]*?)(isSectionBasedPack|getSections)([^}]*?)}\s*from\s*"@aligntrue\/schema"/g,
      (match, before, legacy, after) => {
        // Clean up the import list
        const cleaned = (before + after)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s)
          .join(", ");

        if (!cleaned) {
          return "";
        }

        return `import { ${cleaned} } from "@aligntrue/schema"`;
      },
    );

    // 2. Remove AlignRule imports
    content = content.replace(
      /import\s+type\s+{\s*AlignRule\s*}\s+from\s+"@aligntrue\/schema";\n?/g,
      "",
    );

    // 3. Remove unused ModeHints, extractModeConfig imports
    content = content.replace(
      /import\s+type\s+{\s*ModeHints\s*}\s+from\s+"@aligntrue\/core";\n?/g,
      "",
    );
    content = content.replace(
      /import\s+{\s*extractModeConfig[\s\S]*?}\s+from\s+"\.\.\/utils\/index\.js";\n?/g,
      'import { computeContentHash } from "@aligntrue/schema";\n',
    );

    // 4. Simplify export method - remove format detection
    content = content.replace(
      /const\s+useSections\s*=\s*isSectionBasedPack\(pack\);\s*const\s+sections\s*=\s*useSections\s*\?\s*pack\.sections!\s*:\s*\[\];/g,
      "const sections = pack.sections;",
    );

    content = content.replace(
      /const\s+sections\s*=\s*getSections\(pack\);/g,
      "const sections = pack.sections;",
    );

    // 5. Remove request.rules destructuring
    content = content.replace(
      /const\s+{\s*scope\s*,\s*rules\s*,\s*pack\s*}\s*=\s*request;/g,
      "const { scope, pack } = request;",
    );

    content = content.replace(
      /const\s+{\s*scope\s*,\s*rules\s*,\s*pack\s*,\s*outputPath\s*}\s*=\s*request;/g,
      "const { scope, pack, outputPath } = request;",
    );

    // 6. Check for computeFidelityNotes override
    if (
      /override\s+computeFidelityNotes\s*\(\s*rules:\s*AlignRule\[\]\s*\)/.test(
        content,
      )
    ) {
      needsManualReview.push(exporterName);
    }

    // 7. Remove rules validation checks
    content = content.replace(
      /if\s*\(\s*\(!rules\s*\|\|\s*rules\.length\s*===\s*0\)\s*&&\s*sections\.length\s*===\s*0\s*\)/g,
      "if (sections.length === 0)",
    );

    // 8. Clean empty lines
    content = content.replace(/\n\n\n+/g, "\n\n");

    if (content !== original) {
      writeFileSync(filePath, content, "utf8");
      fixedCount++;
      console.log(`✅ ${exporterName}`);
    } else {
      console.log(`⏭️  ${exporterName} - no auto-fixes applied`);
    }
  } catch (err) {
    errorCount++;
    console.error(`❌ ${exporterName}: ${err.message}`);
  }
});

console.log(`\n📊 Results:`);
console.log(`   ✅ Auto-migrated: ${fixedCount}`);
console.log(`   ⚠️  Need manual review: ${needsManualReview.length}`);
console.log(`   ❌ Errors: ${errorCount}`);

if (needsManualReview.length > 0) {
  console.log(`\n📝 Exporters needing manual override removal:`);
  needsManualReview.forEach((name) => {
    console.log(`   - ${name}`);
  });
}

console.log("\n▶️  Next: Run build to check for remaining errors");
console.log("   pnpm --filter @aligntrue/exporters build\n");
