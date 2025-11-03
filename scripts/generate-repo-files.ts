#!/usr/bin/env node
/**
 * Generate repo root files (README.md, CONTRIBUTING.md, DEVELOPMENT.md, POLICY.md)
 * from canonical docs site content (apps/docs/content/).
 *
 * This implements the docs-first architecture where docs are the IR and
 * repo files are exports - mirroring AlignTrue's own philosophy.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "apps/docs/content");

interface GeneratedFile {
  source: string | string[];
  dest: string;
  transform: (content: string | string[]) => string;
}

const AUTO_GEN_HEADER = `<!-- AUTO-GENERATED from apps/docs/content - DO NOT EDIT DIRECTLY -->
<!-- Edit the source files in apps/docs/content and run 'pnpm generate:repo-files' -->

`;

const FOOTER = `

---

**This file is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs).**  
**To propose changes, edit the source files in \`apps/docs/content/\` and run \`pnpm generate:repo-files\`.**
`;

/**
 * Transform relative doc links to absolute URLs for GitHub
 */
function transformLinks(content: string): string {
  return (
    content
      // Transform relative links to absolute
      .replace(
        /\[([^\]]+)\]\(\/([^)]+)\)/g,
        "[$1](https://aligntrue.ai/docs/$2)",
      )
      // Keep external links unchanged
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "[$1]($2)")
  );
}

/**
 * Strip MDX frontmatter from content
 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n\n/, "");
}

/**
 * Read a single markdown file
 */
async function readMarkdownFile(filePath: string): Promise<string> {
  const fullPath = path.join(DOCS_DIR, filePath);
  return await fs.readFile(fullPath, "utf-8");
}

/**
 * Read and concatenate multiple markdown files
 */
async function readMarkdownFiles(filePaths: string[]): Promise<string> {
  const contents = await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await readMarkdownFile(filePath);
      return stripFrontmatter(content);
    }),
  );
  return contents.join("\n\n---\n\n");
}

/**
 * Generate README.md from docs homepage
 */
function transformReadme(content: string): string {
  const stripped = stripFrontmatter(content);
  const transformed = transformLinks(stripped);

  // Remove the "AlignTrue" h1 since GitHub shows repo name
  const withoutTitle = transformed.replace(/^# AlignTrue\n\n/, "");

  return AUTO_GEN_HEADER + withoutTitle + FOOTER;
}

/**
 * Generate CONTRIBUTING.md from 05-contributing/creating-packs.md
 */
function transformContributing(content: string): string {
  const stripped = stripFrontmatter(content);
  const transformed = transformLinks(stripped);

  // Change title to match expected filename
  const withTitle = transformed.replace(
    /^# Creating packs/,
    "# Contributing to AlignTrue",
  );

  return AUTO_GEN_HEADER + withTitle + FOOTER;
}

/**
 * Generate DEVELOPMENT.md from development section pages
 */
function transformDevelopment(contents: string[]): string {
  // Contents is array of [setup, workspace, commands, architecture]
  const [setup, workspace, commands, architecture] = contents;

  const transformed = [setup, workspace, commands, architecture]
    .map((content) => transformLinks(stripFrontmatter(content)))
    .join("\n\n---\n\n");

  const header = `# Development guide

This guide is auto-generated from the [AlignTrue documentation site](https://aligntrue.ai/docs/development).

`;

  return AUTO_GEN_HEADER + header + transformed + FOOTER;
}

/**
 * Generate POLICY.md from policies/index.md
 */
function transformPolicy(content: string): string {
  const stripped = stripFrontmatter(content);
  const transformed = transformLinks(stripped);

  // Change title to match expected filename
  const withTitle = transformed.replace(
    /^# AlignTrue registry policy/,
    "# AlignTrue Registry Policy",
  );

  return AUTO_GEN_HEADER + withTitle + FOOTER;
}

/**
 * File generation configuration
 */
const FILES_TO_GENERATE: GeneratedFile[] = [
  {
    source: "index.mdx",
    dest: "README.md",
    transform: (content) => transformReadme(content as string),
  },
  {
    source: "05-contributing/creating-packs.md",
    dest: "CONTRIBUTING.md",
    transform: (content) => transformContributing(content as string),
  },
  {
    source: [
      "07-development/setup.md",
      "07-development/workspace.md",
      "07-development/commands.md",
      "07-development/architecture.md",
    ],
    dest: "DEVELOPMENT.md",
    transform: (contents) => transformDevelopment(contents as string[]),
  },
  {
    source: "06-policies/index.md",
    dest: "POLICY.md",
    transform: (content) => transformPolicy(content as string),
  },
];

/**
 * Generate a single file
 */
async function generateFile(config: GeneratedFile): Promise<void> {
  console.log(`Generating ${config.dest}...`);

  try {
    let content: string | string[];

    if (Array.isArray(config.source)) {
      content = await Promise.all(
        config.source.map((src) => readMarkdownFile(src)),
      );
    } else {
      content = await readMarkdownFile(config.source);
    }

    const transformed = config.transform(content);
    const destPath = path.join(ROOT_DIR, config.dest);

    await fs.writeFile(destPath, transformed, "utf-8");
    console.log(`✓ Generated ${config.dest}`);
  } catch (error) {
    console.error(`✗ Failed to generate ${config.dest}:`, error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log("Generating repo root files from docs...\n");

  try {
    await Promise.all(FILES_TO_GENERATE.map(generateFile));

    console.log("\n✓ All files generated successfully!");

    // Clean Next.js caches after regenerating docs to prevent stale module errors
    try {
      const { execSync } = await import("child_process");
      execSync("rm -rf apps/docs/.next apps/web/.next", { stdio: "ignore" });
      console.log("✓ Cleaned Next.js build caches");
    } catch (error) {
      // Non-fatal: dev server will rebuild on next request
    }

    console.log("\nGenerated files:");
    FILES_TO_GENERATE.forEach((config) => {
      console.log(`  - ${config.dest}`);
    });
  } catch (error) {
    console.error("\n✗ Generation failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, generateFile, FILES_TO_GENERATE };
