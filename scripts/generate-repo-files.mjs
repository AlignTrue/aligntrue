#!/usr/bin/env node

/**
 * Generate repo root files from docs site content
 *
 * This script implements the docs-first architecture where:
 * - apps/docs/content/ is the canonical source
 * - README.md, CONTRIBUTING.md, DEVELOPMENT.md, SECURITY.md are generated exports
 *
 * Mappings:
 * - apps/docs/content/index.mdx → README.md
 * - apps/docs/content/06-contributing/creating-aligns.md → CONTRIBUTING.md
 * - apps/docs/content/08-development/*.md → DEVELOPMENT.md (concatenated)
 * - apps/docs/content/07-policies/security.md → SECURITY.md
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "..");
const docsContentDir = join(rootDir, "apps/docs/content");

/**
 * Strip MDX/MD frontmatter from content
 */
function stripFrontmatter(content) {
  const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
  return content.replace(frontmatterRegex, "");
}

/**
 * Transform relative /docs/ links to absolute GitHub URLs
 */
function transformLinks(
  content,
  repoUrl = "https://github.com/AlignTrue/aligntrue",
) {
  // Transform /docs/ links to full docs site URLs
  content = content.replace(
    /\[([^\]]+)\]\(\/docs\/([^)]+)\)/g,
    (match, text, path) => {
      return `[${text}](https://aligntrue.ai/docs/${path})`;
    },
  );

  // Transform relative links to repo URLs
  content = content.replace(
    /\[([^\]]+)\]\(\.\.\/([^)]+)\)/g,
    (match, text, path) => {
      return `[${text}](${repoUrl}/blob/main/${path})`;
    },
  );

  return content;
}

/**
 * Add auto-generation header
 */
function addHeader(filename) {
  return `<!-- 
  ⚠️  AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
  
  This file is generated from documentation source.
  To make changes, edit the source file and run: pnpm generate:repo-files
  
  Source: apps/docs/content/${filename}
-->

`;
}

/**
 * Add auto-generation footer
 */
function addFooter() {
  return `\n\n---

*This file is auto-generated from the AlignTrue documentation site. To make changes, edit the source files in \`apps/docs/content/\` and run \`pnpm generate:repo-files\`.*
`;
}

/**
 * Generate README.md from index.mdx
 */
function generateReadme() {
  console.log("Generating README.md...");

  const sourcePath = join(docsContentDir, "index.mdx");
  let content = readFileSync(sourcePath, "utf-8");

  // Strip frontmatter
  content = stripFrontmatter(content);

  // Transform links
  content = transformLinks(content);

  // Add header and footer
  content = addHeader("index.mdx") + content + addFooter();

  // Write to root
  const outputPath = join(rootDir, "README.md");
  writeFileSync(outputPath, content, "utf-8");

  console.log("✓ README.md generated");
}

/**
 * Generate CONTRIBUTING.md from creating-aligns.md
 */
function generateContributing() {
  console.log("Generating CONTRIBUTING.md...");

  const sourcePath = join(docsContentDir, "06-contributing/creating-aligns.md");
  let content = readFileSync(sourcePath, "utf-8");

  // Strip frontmatter
  content = stripFrontmatter(content);

  // Transform links
  content = transformLinks(content);

  // Add header and footer
  content =
    addHeader("06-contributing/creating-aligns.md") + content + addFooter();

  // Write to root
  const outputPath = join(rootDir, "CONTRIBUTING.md");
  writeFileSync(outputPath, content, "utf-8");

  console.log("✓ CONTRIBUTING.md generated");
}

/**
 * Generate DEVELOPMENT.md from development/*.md files
 */
function generateDevelopment() {
  console.log("Generating DEVELOPMENT.md...");

  const devDir = join(docsContentDir, "08-development");
  const files = readdirSync(devDir)
    .filter((f) => f.endsWith(".md") || f.endsWith(".mdx"))
    .filter((f) => f !== "index.md" && f !== "index.mdx")
    .sort();

  let content = "# Development Guide\n\n";
  content +=
    "> This guide is auto-generated from the AlignTrue documentation site.\n\n";
  content += "## Table of Contents\n\n";

  // Generate TOC
  for (const file of files) {
    const filePath = join(devDir, file);
    const fileContent = readFileSync(filePath, "utf-8");
    const stripped = stripFrontmatter(fileContent);
    const match = stripped.match(/^#\s+(.+)$/m);
    if (match) {
      const title = match[1];
      const anchor = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      content += `- [${title}](#${anchor})\n`;
    }
  }

  content += "\n---\n\n";

  // Concatenate all files
  for (const file of files) {
    const filePath = join(devDir, file);
    let fileContent = readFileSync(filePath, "utf-8");

    // Strip frontmatter
    fileContent = stripFrontmatter(fileContent);

    // Transform links
    fileContent = transformLinks(fileContent);

    content += fileContent + "\n\n---\n\n";
  }

  // Add header and footer
  content = addHeader("08-development/*.md") + content + addFooter();

  // Write to root
  const outputPath = join(rootDir, "DEVELOPMENT.md");
  writeFileSync(outputPath, content, "utf-8");

  console.log("✓ DEVELOPMENT.md generated");
}

/**
 * Generate SECURITY.md from security.md
 */
function generateSecurity() {
  console.log("Generating SECURITY.md...");

  const sourcePath = join(docsContentDir, "07-policies/security.md");
  let content = readFileSync(sourcePath, "utf-8");

  // Strip frontmatter
  content = stripFrontmatter(content);

  // Transform links
  content = transformLinks(content);

  // Add header and footer
  content = addHeader("07-policies/security.md") + content + addFooter();

  // Write to root
  const outputPath = join(rootDir, "SECURITY.md");
  writeFileSync(outputPath, content, "utf-8");

  console.log("✓ SECURITY.md generated");
}

/**
 * Main execution
 */
function main() {
  console.log("Generating repo files from docs site...\n");

  try {
    generateReadme();
    generateContributing();
    generateDevelopment();
    generateSecurity();

    console.log("\n✓ All repo files generated successfully");
    console.log("\nNext steps:");
    console.log(
      "  1. Review changes: git diff README.md CONTRIBUTING.md DEVELOPMENT.md SECURITY.md",
    );
    console.log("  2. Commit both docs source and generated files");
  } catch (error) {
    console.error("\n✗ Error generating repo files:", error.message);
    process.exit(1);
  }
}

main();
