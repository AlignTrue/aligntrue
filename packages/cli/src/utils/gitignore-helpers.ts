/**
 * Gitignore utilities for the CLI
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";

/**
 * Add an entry to .gitignore with a section comment
 *
 * @param entry - The entry to add (file or pattern)
 * @param comment - Optional comment to describe the entry
 * @param cwd - Working directory (default: process.cwd())
 */
export async function addToGitignore(
  entry: string,
  comment?: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");

  // Normalize entry path if it's within .aligntrue/
  let normalizedEntry = entry;
  if (entry.startsWith(".aligntrue/")) {
    normalizedEntry = entry;
  } else if (!entry.startsWith("/") && !entry.startsWith("*")) {
    // If it's a relative path within .aligntrue, prepend the directory
    normalizedEntry = `.aligntrue/${entry}`;
  }

  // Check if entry already exists
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    const lines = content.split("\n");

    // Check for existing entry
    if (lines.some((line) => line.trim() === normalizedEntry)) {
      return; // Already in .gitignore
    }
  }

  // Build the entry with optional comment
  let entryLines = "";
  if (comment) {
    entryLines = `\n# ${comment}\n${normalizedEntry}\n`;
  } else {
    entryLines = `\n${normalizedEntry}\n`;
  }

  // Append to .gitignore
  // Note: This TOCTOU pattern is acceptable for gitignore management where race
  // conditions are low risk and don't affect correctness
  /* eslint-disable custom-rules/no-check-then-operate */
  if (existsSync(gitignorePath)) {
    appendFileSync(gitignorePath, entryLines, "utf-8");
  } else {
    writeFileSync(gitignorePath, entryLines.trim() + "\n", "utf-8");
  }
  /* eslint-enable custom-rules/no-check-then-operate */
}

/**
 * Remove an entry from .gitignore
 *
 * @param entry - The entry to remove
 * @param cwd - Working directory (default: process.cwd())
 */
export async function removeFromGitignore(
  entry: string,
  cwd: string = process.cwd(),
): Promise<void> {
  const gitignorePath = join(cwd, ".gitignore");

  if (!existsSync(gitignorePath)) {
    return;
  }

  const content = readFileSync(gitignorePath, "utf-8");
  const lines = content.split("\n");

  // Normalize entry path
  let normalizedEntry = entry;
  if (entry.startsWith(".aligntrue/")) {
    normalizedEntry = entry;
  } else if (!entry.startsWith("/") && !entry.startsWith("*")) {
    normalizedEntry = `.aligntrue/${entry}`;
  }

  // Filter out the entry and any preceding comment line
  const filteredLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];
    if (currentLine === undefined) continue;

    const line = currentLine.trim();
    if (line === normalizedEntry) {
      // Skip this line, and also skip preceding comment if it matches
      if (
        filteredLines.length > 0 &&
        filteredLines[filteredLines.length - 1]?.startsWith("# ")
      ) {
        filteredLines.pop();
      }
      continue;
    }
    filteredLines.push(currentLine);
  }

  writeFileSync(gitignorePath, filteredLines.join("\n"), "utf-8");
}

/**
 * Check if an entry exists in .gitignore
 *
 * @param entry - The entry to check
 * @param cwd - Working directory (default: process.cwd())
 */
export function isInGitignore(
  entry: string,
  cwd: string = process.cwd(),
): boolean {
  const gitignorePath = join(cwd, ".gitignore");

  if (!existsSync(gitignorePath)) {
    return false;
  }

  const content = readFileSync(gitignorePath, "utf-8");
  const lines = content.split("\n");

  // Normalize entry path
  let normalizedEntry = entry;
  if (entry.startsWith(".aligntrue/")) {
    normalizedEntry = entry;
  } else if (!entry.startsWith("/") && !entry.startsWith("*")) {
    normalizedEntry = `.aligntrue/${entry}`;
  }

  return lines.some((line) => line.trim() === normalizedEntry);
}
