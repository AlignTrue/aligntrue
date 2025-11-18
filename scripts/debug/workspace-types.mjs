#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

function logSection(title) {
  console.log(`\n=== ${title} ===`);
}

function readSnippet(label, filePath, regex) {
  logSection(label);
  try {
    const content = readFileSync(filePath, "utf8");
    const match = content.match(regex);
    console.log(match ? match[0] : "(pattern not found)");
  } catch (error) {
    console.log(`Error reading ${filePath}: ${error.message}`);
  }
}

function resolveModule(label, specifier) {
  logSection(label);
  try {
    const resolved = require.resolve(specifier);
    console.log(`${specifier} → ${resolved}`);
    return resolved;
  } catch (error) {
    console.log(`Failed to resolve ${specifier}: ${error.message}`);
    return null;
  }
}

console.log("🩺 Workspace type diagnostics");

const editedFileRegex = /interface EditedFile[\s\S]+?format:[^\n]+/;
const formatTypeRegex = /formatType:[^\n]+/;

readSnippet(
  "Source EditedFile interface (packages/core/src)",
  join(root, "packages/core/src/sync/multi-file-parser.ts"),
  editedFileRegex,
);

readSnippet(
  "Built EditedFile interface (packages/core/dist)",
  join(root, "packages/core/dist/sync/multi-file-parser.d.ts"),
  editedFileRegex,
);

readSnippet(
  "Built ExporterBase formatType (packages/exporters/dist)",
  join(root, "packages/exporters/dist/base/exporter-base.d.ts"),
  formatTypeRegex,
);

const resolvedCore = resolveModule(
  "Node resolution (@aligntrue/core)",
  "@aligntrue/core/dist/sync/multi-file-parser.js",
);

if (resolvedCore) {
  const dtsPath = resolvedCore.replace(/\.js$/, ".d.ts");
  readSnippet("Resolved node_modules definition", dtsPath, editedFileRegex);
}

console.log("\nNext steps:");
console.log(
  "1. Run `pnpm validate:workspace` to ensure package.json versions use workspace:*.",
);
console.log(
  "2. Run `pnpm verify:workspace-links` to confirm node_modules links point at /packages.",
);
console.log(
  "3. Run `pnpm build:packages` to refresh dist files for all packages.",
);
console.log("\nDone.");
