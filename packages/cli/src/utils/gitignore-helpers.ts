/**
 * Gitignore utilities for the CLI
 */

import { readFileSync, writeFileSync, appendFileSync } from "fs";
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
  let existingContent = "";
  try {
    existingContent = readFileSync(gitignorePath, "utf-8");
    const lines = existingContent.split(/\r?\n/);
    if (lines.some((line) => line.trim() === normalizedEntry)) {
      return; // Already in .gitignore
    }
  } catch (error) {
    // If the file does not exist yet, we'll create it below; rethrow other errors
    if (
      !(error instanceof Error) ||
      (error as NodeJS.ErrnoException).code !== "ENOENT"
    ) {
      throw error;
    }
  }

  // Build the entry with optional comment
  const entryLines: string[] = [];
  if (comment) {
    entryLines.push(`# ${comment}`);
  }
  entryLines.push(normalizedEntry);
  const needsLeadingNewline =
    existingContent.length > 0 && !existingContent.endsWith("\n");
  const entryText =
    (needsLeadingNewline ? "\n" : "") + entryLines.join("\n") + "\n";

  // Append (or create) .gitignore; appendFileSync with flag "a" is atomic per write
  appendFileSync(gitignorePath, entryText, { encoding: "utf-8", flag: "a" });
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

  let content: string;
  try {
    content = readFileSync(gitignorePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return; // Nothing to remove
    }
    throw error;
  }
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

  let content: string;
  try {
    content = readFileSync(gitignorePath, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }
    throw error;
  }
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
