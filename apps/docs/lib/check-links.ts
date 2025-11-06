/**
 * Link Checker for AlignTrue Documentation
 *
 * Scans all .md and .mdx files in content/ and verifies that all
 * internal /docs/ links point to existing files.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_ROOT = path.join(__dirname, "../content");
const LINK_PATTERN = /\[([^\]]+)\]\(\/docs\/([^)#]+)(?:#[^)]+)?\)/g;

export interface BrokenLink {
  file: string;
  linkText: string;
  linkPath: string;
  line: number;
  expectedFile: string;
}

/**
 * Recursively get all .md and .mdx files from a directory
 */
function getAllMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      // Skip hidden directories and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Convert a /docs/ link path to the actual file path
 */
function linkToFilePath(linkPath: string): string {
  // Handle index pages
  if (!linkPath || linkPath === "") {
    return path.join(DOCS_ROOT, "index.mdx");
  }

  // Split the path into segments
  const segments = linkPath.split("/").filter((s) => s);

  if (segments.length === 0) {
    return path.join(DOCS_ROOT, "index.mdx");
  }

  // First segment might be a section number (e.g., "00-getting-started")
  const firstSegment = segments[0];

  // Try to build the path
  let filePath: string;

  if (firstSegment === "about") {
    filePath = path.join(DOCS_ROOT, "about.md");
  } else {
    // Construct directory path from segments
    const joinedPath = segments.join(path.sep);

    // Try with .md first, then .mdx
    filePath = path.join(DOCS_ROOT, joinedPath + ".md");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath + ".mdx");
    }
    // Also try as an index file in a directory
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath, "index.md");
    }
    if (!fs.existsSync(filePath)) {
      filePath = path.join(DOCS_ROOT, joinedPath, "index.mdx");
    }
  }

  return filePath;
}

/**
 * Check if a link target exists
 */
function linkExists(linkPath: string): boolean {
  const filePath = linkToFilePath(linkPath);
  return fs.existsSync(filePath);
}

/**
 * Check all links in a file
 */
function checkLinksInFile(filePath: string): BrokenLink[] {
  const relativePath = path.relative(DOCS_ROOT, filePath);
  const content = fs.readFileSync(filePath, "utf-8");

  let match;
  const errors: BrokenLink[] = [];

  // Reset regex state
  LINK_PATTERN.lastIndex = 0;

  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const linkText = match[1];
    const linkPath = match[2];

    if (!linkExists(linkPath)) {
      errors.push({
        file: relativePath,
        linkText,
        linkPath,
        line: content.substring(0, match.index).split("\n").length,
        expectedFile: linkToFilePath(linkPath),
      });
    }
  }

  return errors;
}

/**
 * Check all documentation links
 */
export function checkAllLinks(): BrokenLink[] {
  const files = getAllMarkdownFiles(DOCS_ROOT);
  const allErrors: BrokenLink[] = [];

  for (const file of files) {
    const fileErrors = checkLinksInFile(file);
    allErrors.push(...fileErrors);
  }

  return allErrors;
}

/**
 * Get statistics about checked links
 */
export function getLinkStats(): { totalFiles: number; totalLinks: number } {
  const files = getAllMarkdownFiles(DOCS_ROOT);
  let totalLinks = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const matches = content.match(LINK_PATTERN);
    if (matches) {
      totalLinks += matches.length;
    }
  }

  return {
    totalFiles: files.length,
    totalLinks,
  };
}
