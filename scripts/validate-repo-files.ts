#!/usr/bin/env node
/**
 * Validate that repo root files (README.md, CONTRIBUTING.md, DEVELOPMENT.md, POLICY.md)
 * match their generated versions from docs content.
 *
 * Used in CI to enforce docs-first workflow and catch manual edits to repo files.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { FILES_TO_GENERATE } from "./generate-repo-files.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "apps/docs/content");

interface ValidationResult {
  file: string;
  valid: boolean;
  message?: string;
}

/**
 * Strip MDX frontmatter from content
 */
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n\n/, "");
}

/**
 * Transform relative doc links to absolute URLs for GitHub
 */
function transformLinks(content: string): string {
  return content
    .replace(/\[([^\]]+)\]\(\/([^)]+)\)/g, "[$1](https://aligntrue.ai/docs/$2)")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "[$1]($2)");
}

/**
 * Read a markdown file from docs
 */
async function readMarkdownFile(filePath: string): Promise<string> {
  const fullPath = path.join(DOCS_DIR, filePath);
  return await fs.readFile(fullPath, "utf-8");
}

/**
 * Format content with prettier to match what lint-staged will do
 */
async function formatWithPrettier(
  content: string,
  filepath: string,
): Promise<string> {
  try {
    // Write to temp file, format it, read back
    const tempFile = path.join(
      ROOT_DIR,
      `.temp-validate-${path.basename(filepath)}`,
    );
    await fs.writeFile(tempFile, content, "utf-8");
    execSync(`pnpm prettier --write ${tempFile}`, { stdio: "pipe" });
    const formatted = await fs.readFile(tempFile, "utf-8");
    await fs.unlink(tempFile);
    return formatted;
  } catch (error) {
    // If prettier fails, return original content
    return content;
  }
}

/**
 * Generate content for a file based on its configuration
 */
async function generateContent(
  config: (typeof FILES_TO_GENERATE)[0],
): Promise<string> {
  let content: string | string[];

  if (Array.isArray(config.source)) {
    content = await Promise.all(
      config.source.map((src) => readMarkdownFile(src)),
    );
  } else {
    content = await readMarkdownFile(config.source);
  }

  const transformed = config.transform(content);

  // Format with prettier to match what the generate script does
  return await formatWithPrettier(transformed, config.dest);
}

/**
 * Validate a single file
 */
async function validateFile(
  config: (typeof FILES_TO_GENERATE)[0],
): Promise<ValidationResult> {
  try {
    // Generate expected content
    const expectedContent = await generateContent(config);

    // Read actual file
    const actualPath = path.join(ROOT_DIR, config.dest);
    const actualContent = await fs.readFile(actualPath, "utf-8");

    // Compare
    if (expectedContent === actualContent) {
      return {
        file: config.dest,
        valid: true,
      };
    }

    return {
      file: config.dest,
      valid: false,
      message: "File content differs from generated version",
    };
  } catch (error) {
    return {
      file: config.dest,
      valid: false,
      message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Main validation function
 */
async function main() {
  console.log("Validating repo root files against docs content...\n");

  const results = await Promise.all(FILES_TO_GENERATE.map(validateFile));

  const invalid = results.filter((r) => !r.valid);

  if (invalid.length === 0) {
    console.log("✓ All repo files match generated versions!\n");
    console.log("Validated files:");
    results.forEach((r) => {
      console.log(`  ✓ ${r.file}`);
    });
    process.exit(0);
  }

  console.error("✗ Validation failed!\n");
  console.error("The following files have manual edits:\n");

  invalid.forEach((r) => {
    console.error(`  ✗ ${r.file}`);
    if (r.message) {
      console.error(`    ${r.message}`);
    }
  });

  console.error("\n" + "=".repeat(60));
  console.error("ERROR: Repo files must be generated from docs content");
  console.error("=".repeat(60));
  console.error("\nAlignTrue uses a docs-first architecture:");
  console.error("  - Edit files in apps/docs/content/");
  console.error("  - Run 'pnpm generate:repo-files' to update repo files");
  console.error("  - Commit both docs source and generated files");
  console.error("\nSee docs/contributing/editing-docs for complete workflow.");
  console.error("=".repeat(60) + "\n");

  process.exit(1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main, validateFile };
