#!/usr/bin/env node

/**
 * Validates that there are no duplicate .md/.mdx files in the docs content directory.
 * This prevents routing conflicts and content duplication in Nextra.
 *
 * Exit codes:
 * 0 - No duplicates found
 * 1 - Duplicates found
 */

import { readdir } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DOCS_CONTENT_DIR = join(__dirname, "..", "apps", "docs", "content");

/**
 * Recursively find all .md and .mdx files
 */
async function findMarkdownFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await findMarkdownFiles(fullPath, files);
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Group files by their base name (without extension)
 */
function groupByBaseName(files) {
  const groups = new Map();

  for (const file of files) {
    const dir = file.substring(0, file.lastIndexOf("/"));
    const name = basename(file, extname(file));
    const key = `${dir}/${name}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(file);
  }

  return groups;
}

async function main() {
  console.log("🔍 Checking for duplicate .md/.mdx files in docs...\n");

  const files = await findMarkdownFiles(DOCS_CONTENT_DIR);
  const groups = groupByBaseName(files);

  const duplicates = Array.from(groups.entries()).filter(
    ([_, files]) => files.length > 1,
  );

  if (duplicates.length === 0) {
    console.log("✓ No duplicate .md/.mdx files found");
    process.exit(0);
  }

  console.error("✗ Found duplicate .md/.mdx files:\n");

  for (const [baseName, files] of duplicates) {
    const relativePaths = files.map((f) =>
      f.replace(DOCS_CONTENT_DIR, "apps/docs/content"),
    );
    console.error(`  ${baseName}:`);
    for (const path of relativePaths) {
      console.error(`    - ${path}`);
    }
    console.error();
  }

  console.error(
    "Fix: Remove duplicate files. Nextra uses .mdx for interactive components.\n",
  );
  console.error(
    "If both files exist, keep the .mdx version and delete the .md version.\n",
  );

  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(2);
});

